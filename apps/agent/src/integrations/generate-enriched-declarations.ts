import fs from "node:fs/promises";
import path from "node:path";

import { Logger } from "@weldr/shared/logger";
import type { DeclarationCodeMetadata } from "@weldr/shared/types/declarations";
import { enrichDeclaration } from "../ai/utils/enrich";
import { extractDeclarations } from "../lib/extract-declarations";

const logger = Logger.get({ module: "generate-enriched-declarations" });

interface EnrichedDeclarationsOutput {
  declarations: Array<{
    codeMetadata: DeclarationCodeMetadata;
    semanticData: Awaited<ReturnType<typeof enrichDeclaration>>;
  }>;
  generatedAt: string;
  sourceFilePath: string;
}

/**
 * Recursively finds all TypeScript files in data folders within the integrations directory
 */
async function findTsFiles(
  dir: string,
  inDataFolder = false,
): Promise<string[]> {
  const tsFiles: string[] = [];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Check if this is a data folder
        const isDataFolder = entry.name === "data" || inDataFolder;

        // Recursively search subdirectories
        const subFiles = await findTsFiles(fullPath, isDataFolder);
        tsFiles.push(...subFiles);
      } else if (
        entry.isFile() &&
        entry.name.endsWith(".ts") &&
        !entry.name.endsWith(".d.ts") &&
        inDataFolder // Only include files if we're inside a data folder
      ) {
        tsFiles.push(fullPath);
      }
    }
  } catch (error) {
    logger.warn(`Failed to read directory: ${dir}`, {
      extra: { error: error instanceof Error ? error.message : String(error) },
    });
  }

  return tsFiles;
}

/**
 * Determines the output path for the declarations.json file based on the integration structure
 */
function getDeclarationsOutputPath(
  tsFilePath: string,
  integrationsBaseDir: string,
): string {
  // Find the data folder in the path and put declarations.json at its root
  const relativePath = path.relative(integrationsBaseDir, tsFilePath);
  const pathParts = relativePath.split(path.sep);

  // Find the index of 'data' folder
  const dataIndex = pathParts.indexOf("data");

  if (dataIndex === -1) {
    logger.warn(`File ${tsFilePath} is not in a data folder`);
    return path.join(path.dirname(tsFilePath), "declarations.json");
  }

  // Build path up to and including the data folder
  const dataFolderPath = path.join(
    integrationsBaseDir,
    ...pathParts.slice(0, dataIndex + 1),
  );

  // Place declarations.json at the root of the data folder
  return path.join(dataFolderPath, "declarations.json");
}

/**
 * Groups TypeScript files by their target declarations.json output path
 */
function groupFilesByOutputPath(
  tsFiles: string[],
  integrationsBaseDir: string,
): Map<string, string[]> {
  const grouped = new Map<string, string[]>();

  for (const tsFile of tsFiles) {
    const outputPath = getDeclarationsOutputPath(tsFile, integrationsBaseDir);

    if (!grouped.has(outputPath)) {
      grouped.set(outputPath, []);
    }

    const fileGroup = grouped.get(outputPath);
    if (fileGroup) {
      fileGroup.push(tsFile);
    }
  }

  return grouped;
}

/**
 * Determines path aliases based on the file path
 */
function getPathAliases(filePath: string): Record<string, string> | undefined {
  // Check if the file is in a server or web directory
  if (filePath.includes("/server/")) {
    return {
      "@repo/server/*": "./src/*",
    };
  } else if (filePath.includes("/web/")) {
    return {
      "@repo/web/*": "./src/*",
    };
  }

  // No aliases for other locations
  return undefined;
}

/**
 * Processes a single TypeScript file to extract and enrich its declarations
 */
async function processTypeScriptFile(
  filePath: string,
): Promise<EnrichedDeclarationsOutput["declarations"]> {
  try {
    logger.info(`Processing file: ${filePath}`);

    // Read the source code
    const sourceCode = await fs.readFile(filePath, "utf-8");

    // Determine path aliases based on file location
    const pathAliases = getPathAliases(filePath);

    // Extract declarations using the existing utility
    const declarations = await extractDeclarations({
      sourceCode,
      filename: filePath,
      pathAliases,
    });

    logger.info(
      `Extracted ${declarations.length} declarations from ${filePath}`,
    );

    // Enrich each declaration
    const enrichedDeclarations: EnrichedDeclarationsOutput["declarations"] = [];

    for (const declaration of declarations) {
      try {
        logger.info(
          `Enriching declaration: ${declaration.name} (${declaration.type})`,
        );

        const semanticData = await enrichDeclaration(
          declaration,
          filePath,
          sourceCode,
        );

        enrichedDeclarations.push({
          codeMetadata: declaration,
          semanticData,
        });

        if (semanticData) {
          logger.info(`Successfully enriched ${declaration.name}`, {
            extra: {
              tags: semanticData.tags,
              useCases: semanticData.usagePattern.commonUseCases.length,
            },
          });
        } else {
          logger.warn(`Failed to enrich ${declaration.name}`);
        }
      } catch (error) {
        logger.error(`Failed to enrich declaration ${declaration.name}`, {
          extra: {
            error: error instanceof Error ? error.message : String(error),
            declarationType: declaration.type,
          },
        });

        // Still include the declaration without semantic data
        enrichedDeclarations.push({
          codeMetadata: declaration,
          semanticData: null,
        });
      }
    }

    return enrichedDeclarations;
  } catch (error) {
    logger.error(`Failed to process file: ${filePath}`, {
      extra: { error: error instanceof Error ? error.message : String(error) },
    });
    return [];
  }
}

/**
 * Main function to generate enriched declarations for all integrations
 */
export async function generateEnrichedDeclarations(
  integrationsDir?: string,
): Promise<void> {
  const integrationsBaseDir = integrationsDir || path.join(__dirname, ".");

  logger.info(
    `Starting enriched declarations generation for: ${integrationsBaseDir}`,
  );

  try {
    // Find all TypeScript files in the integrations directory
    const tsFiles = await findTsFiles(integrationsBaseDir);

    if (tsFiles.length === 0) {
      logger.info("No TypeScript files found in integrations directory");
      return;
    }

    logger.info(`Found ${tsFiles.length} TypeScript files to process`);

    // Group files by their target output path
    const groupedFiles = groupFilesByOutputPath(tsFiles, integrationsBaseDir);

    logger.info(`Will generate ${groupedFiles.size} declarations.json files`);

    // Process each group
    for (const [outputPath, files] of groupedFiles) {
      logger.info(`Processing ${files.length} files for output: ${outputPath}`);

      const allDeclarations: EnrichedDeclarationsOutput["declarations"] = [];

      // Process all files in this group
      for (const filePath of files) {
        const fileDeclarations = await processTypeScriptFile(filePath);
        allDeclarations.push(...fileDeclarations);
      }

      if (allDeclarations.length === 0) {
        logger.info(`No declarations found for ${outputPath}, skipping`);
        continue;
      }

      // Create the output structure
      const output: EnrichedDeclarationsOutput = {
        declarations: allDeclarations,
        generatedAt: new Date().toISOString(),
        sourceFilePath:
          files.length === 1 && files[0]
            ? files[0]
            : `Multiple files: ${files.length} files`,
      };

      // Ensure the output directory exists
      await fs.mkdir(path.dirname(outputPath), { recursive: true });

      // Write the enriched declarations
      await fs.writeFile(outputPath, JSON.stringify(output, null, 2), "utf-8");

      logger.info(`Generated enriched declarations: ${outputPath}`, {
        extra: {
          declarationsCount: allDeclarations.length,
          filesProcessed: files.length,
          enrichedCount: allDeclarations.filter((d) => d.semanticData !== null)
            .length,
        },
      });
    }

    logger.info("Successfully completed enriched declarations generation");
  } catch (error) {
    logger.error("Failed to generate enriched declarations", {
      extra: { error: error instanceof Error ? error.message : String(error) },
    });
    throw error;
  }
}

// CLI interface when running this file directly
if (require.main === module) {
  const integrationsDir = process.argv[2];
  generateEnrichedDeclarations(integrationsDir)
    .then(() => {
      console.log(" Enriched declarations generation completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("L Failed to generate enriched declarations:", error);
      process.exit(1);
    });
}
