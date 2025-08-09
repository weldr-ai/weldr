import fs from "node:fs/promises";
import path from "node:path";

import { Logger } from "@weldr/shared/logger";
import type { DeclarationCodeMetadata } from "@weldr/shared/types/declarations";
import { enrichDeclaration } from "../ai/utils/enrich";
import { extractDeclarations } from "../lib/extract-declarations";

const logger = Logger.get({ module: "generate-enriched-declarations" });

interface EnrichedDeclaration {
  codeMetadata: DeclarationCodeMetadata;
  semanticData: Awaited<ReturnType<typeof enrichDeclaration>>;
}

async function findTsFiles(dir: string): Promise<string[]> {
  const tsFiles: string[] = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        tsFiles.push(...(await findTsFiles(fullPath)));
      } else if (
        entry.isFile() &&
        entry.name.endsWith(".ts") &&
        !entry.name.endsWith(".d.ts")
      ) {
        tsFiles.push(fullPath);
      }
    }
  } catch (error: unknown) {
    logger.error(`Failed to read directory: ${dir}`, { error });
  }

  return tsFiles;
}

function getDataFolderPath(filePath: string): string | null {
  const dataIndex = filePath.lastIndexOf("/data/");
  if (dataIndex === -1) return null;
  return filePath.substring(0, dataIndex + 5); // Include "/data"
}

function createFileKey(filePath: string): string {
  // Extract everything after /data/
  const dataIndex = filePath.lastIndexOf("/data/");
  if (dataIndex === -1) return filePath;

  let afterData = filePath.substring(dataIndex + 6);

  // Find which app this belongs to by looking at the integration path
  if (filePath.includes("/frontend/tanstack-start/")) {
    // Remove 'web/' prefix if it exists since we'll add 'apps/web/'
    if (afterData.startsWith("web/")) {
      afterData = afterData.substring(4);
    }
    return `apps/web/${afterData}`;
  } else if (filePath.includes("/backend/") || filePath.includes("/server/")) {
    // Remove 'server/' prefix if it exists
    if (afterData.startsWith("server/")) {
      afterData = afterData.substring(7);
    }
    return `apps/server/${afterData}`;
  } else if (filePath.includes("/agent/")) {
    // Remove 'agent/' prefix if it exists
    if (afterData.startsWith("agent/")) {
      afterData = afterData.substring(6);
    }
    return `apps/agent/${afterData}`;
  }

  // Default: try to detect from the file path itself
  return `apps/${afterData}`;
}

async function processFile(
  filePath: string,
  existingDeclarations: Record<string, EnrichedDeclaration[]>,
): Promise<{
  outputPath: string;
  declarations: Record<string, EnrichedDeclaration[]>;
} | null> {
  logger.info(`Processing: ${filePath}`);

  try {
    const sourceCode = await fs.readFile(filePath, "utf-8");

    // Create the filename that will be used in URI generation
    // This should match the key we create (apps/web/src/lib/seo.ts)
    const uriFilename = createFileKey(filePath);

    const declarations = await extractDeclarations({
      sourceCode,
      filename: uriFilename, // Use the transformed filename for URI generation
      pathAliases: filePath.includes("/server/")
        ? { "@repo/server/*": "apps/server/src/*" }
        : filePath.includes("/web/")
          ? { "@repo/web/*": "apps/web/src/*" }
          : undefined,
    });

    if (declarations.length === 0) {
      logger.info(`  No declarations found`);
      return null;
    }

    const enrichedDeclarations: EnrichedDeclaration[] = [];

    for (const declaration of declarations) {
      logger.info(`  Enriching: ${declaration.name} (${declaration.type})`);
      try {
        const semanticData = await enrichDeclaration(
          declaration,
          uriFilename, // Use the transformed filename for consistency
          sourceCode,
        );
        enrichedDeclarations.push({
          codeMetadata: declaration,
          semanticData,
        });
      } catch (error) {
        logger.error(`  Failed to enrich ${declaration.name}: ${error}`);
        enrichedDeclarations.push({
          codeMetadata: declaration,
          semanticData: null,
        });
      }
    }

    const key = createFileKey(filePath);
    existingDeclarations[key] = enrichedDeclarations;

    logger.info(
      `  Added ${enrichedDeclarations.length} declarations for ${key}`,
    );

    // Get the data folder path for this file
    const dataFolder = getDataFolderPath(filePath);
    if (!dataFolder) {
      logger.error(`Could not find data folder for ${filePath}`);
      return null;
    }

    const outputPath = path.join(dataFolder, "declarations.json");
    return { outputPath, declarations: existingDeclarations };
  } catch (error) {
    logger.error(`Failed to process ${filePath}: ${error}`);
    return null;
  }
}

async function loadExistingDeclarations(
  outputPath: string,
): Promise<Record<string, EnrichedDeclaration[]>> {
  try {
    const existing = await fs.readFile(outputPath, "utf-8");
    return JSON.parse(existing);
  } catch {
    return {};
  }
}

export async function generateEnrichedDeclarations(
  targetPath?: string,
): Promise<void> {
  const baseDir = path.join(__dirname, ".");

  // Check if a specific file was provided
  if (targetPath) {
    const absolutePath = path.isAbsolute(targetPath)
      ? targetPath
      : path.resolve(process.cwd(), targetPath);

    // Verify it's a TypeScript file in a data folder
    if (!absolutePath.includes("/data/")) {
      logger.error("File must be in a data/ folder");
      return;
    }

    if (!absolutePath.endsWith(".ts") || absolutePath.endsWith(".d.ts")) {
      logger.error("File must be a TypeScript file (not .d.ts)");
      return;
    }

    // Check file exists
    try {
      await fs.access(absolutePath);
    } catch {
      logger.error(`File not found: ${absolutePath}`);
      return;
    }

    logger.info(`Processing single file: ${absolutePath}`);

    // Get output path for this file's data folder
    const dataFolder = getDataFolderPath(absolutePath);
    if (!dataFolder) {
      logger.error(`Could not find data folder for ${absolutePath}`);
      return;
    }

    const outputPath = path.join(dataFolder, "declarations.json");
    const existingDeclarations = await loadExistingDeclarations(outputPath);

    const result = await processFile(absolutePath, existingDeclarations);
    if (result) {
      await fs.writeFile(
        result.outputPath,
        JSON.stringify(result.declarations, null, 2),
        "utf-8",
      );
      logger.info(`Written to ${result.outputPath}`);
    }
  } else {
    // Process all files grouped by data folder
    logger.info(`Starting generation for all files in: ${baseDir}`);

    const tsFiles = await findTsFiles(baseDir);
    const dataFiles = tsFiles.filter((f) => f.includes("/data/"));

    logger.info(`Found ${dataFiles.length} TypeScript files in data folders`);

    if (dataFiles.length === 0) {
      logger.info("No TypeScript files found in data folders");
      return;
    }

    // Group files by their data folder
    const filesByDataFolder = new Map<string, string[]>();

    for (const filePath of dataFiles) {
      const dataFolder = getDataFolderPath(filePath);
      if (dataFolder) {
        if (!filesByDataFolder.has(dataFolder)) {
          filesByDataFolder.set(dataFolder, []);
        }
        const files = filesByDataFolder.get(dataFolder);
        if (files) {
          files.push(filePath);
        }
      }
    }

    logger.info(`Found ${filesByDataFolder.size} data folders to process`);

    // Process each data folder
    for (const [dataFolder, files] of filesByDataFolder) {
      logger.info(`Processing data folder: ${dataFolder}`);

      const outputPath = path.join(dataFolder, "declarations.json");
      const existingDeclarations = await loadExistingDeclarations(outputPath);

      for (const filePath of files) {
        await processFile(filePath, existingDeclarations);
      }

      if (Object.keys(existingDeclarations).length > 0) {
        await fs.writeFile(
          outputPath,
          JSON.stringify(existingDeclarations, null, 2),
          "utf-8",
        );
        logger.info(
          `  Written ${Object.keys(existingDeclarations).length} file entries to ${outputPath}`,
        );
      }
    }
  }

  logger.info(`Completed processing`);
}

if (require.main === module) {
  generateEnrichedDeclarations(process.argv[2])
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Failed:", error);
      process.exit(1);
    });
}
