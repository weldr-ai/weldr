import { applyEdit } from "@/ai/utils/apply-edit";
import { runCommand } from "@/ai/utils/commands";
import { WORKSPACE_DIR } from "@/lib/constants";
import type { WorkflowContext } from "@/workflow/context";
import type { IntegrationKey } from "@weldr/shared/types";
import path from "node:path";
import type {
  FileItem,
  IntegrationCallbackResult,
  IntegrationDefinition,
} from "../types";
import { replacePatternInContent } from "./file-system";
import { installPackages, updatePackageJsonScripts } from "./packages";
import { getVariablesFromTemplate } from "./templates";

export async function defineIntegration(
  props: Omit<IntegrationDefinition, "files">,
): Promise<IntegrationDefinition> {
  const files = await generateFiles(props.key);
  return {
    files,
    ...props,
    preInstall: async (context) => {
      const results = await Promise.all([
        installPackages({
          packages: props.packages?.add?.runtime ?? {},
        }),
        installPackages({
          packages: props.packages?.add?.development ?? {},
          isDev: true,
        }),
        updatePackageJsonScripts(props.scripts ?? {}),
        props.preInstall?.(context),
      ]);
      return combineResults(results.filter((r) => r !== undefined));
    },
  };
}

export async function applyIntegrationFiles(
  integration: IntegrationDefinition,
  context: WorkflowContext,
): Promise<void> {
  const project = context.get("project");
  let dirMap:
    | Record<string, string>
    | { server?: Record<string, string>; web?: Record<string, string> }
    | undefined;

  if (
    project.type &&
    (project.type === "standalone-backend" ||
      project.type === "standalone-frontend")
  ) {
    dirMap = integration.dirMap?.[project.type];
  }

  for (const file of integration.files) {
    const targetPath = file.path.replace(".txt", "");

    let baseDir = WORKSPACE_DIR;
    if (dirMap) {
      const simpleMap = dirMap as Record<string, string>;
      for (const [pathPattern, mappedDir] of Object.entries(simpleMap)) {
        if (
          file.path.startsWith(pathPattern) &&
          typeof mappedDir === "string"
        ) {
          baseDir = mappedDir;
          break;
        }
      }
    }

    // Read file content once
    const readResult = await runCommand("cat", [file.path], {
      cwd: baseDir,
    });

    if (!readResult.success) {
      console.error(`Failed to read file ${file.path}: ${readResult.stderr}`);
      continue;
    }

    let processedContent = readResult.stdout;

    // Replace @server/ with @/ for standalone-backend projects
    if (project.type === "standalone-backend") {
      processedContent = replacePatternInContent(
        processedContent,
        "@server/",
        "@/",
      );
    }

    try {
      switch (file.type) {
        case "copy": {
          const writeResult = await runCommand("tee", [targetPath], {
            stdin: processedContent,
            cwd: baseDir,
          });

          if (writeResult.success) {
            console.log(
              `Successfully processed and wrote ${file.path} to ${targetPath}`,
            );
          } else {
            throw new Error(
              `Failed to write processed content to ${targetPath}: ${writeResult.stderr}`,
            );
          }
          break;
        }
        case "llm_instruction": {
          const originalContentResult = await runCommand("cat", [targetPath], {
            cwd: baseDir,
          });

          if (!originalContentResult.success) {
            console.error(`Failed to read target file ${targetPath}`);
            continue;
          }

          const updatedContent = await applyEdit({
            originalCode: originalContentResult.stdout,
            editInstructions: processedContent,
          });

          const writeResult = await runCommand("tee", [targetPath], {
            stdin: updatedContent,
            cwd: baseDir,
          });

          if (writeResult.success) {
            console.log(`Successfully applied LLM edits to ${targetPath}`);
          } else {
            throw new Error(`Failed to write updated content to ${targetPath}`);
          }

          break;
        }
        default: {
          console.warn(
            `Unknown file type ${file.type} for ${file.path}, skipping...`,
          );
          break;
        }
      }
    } catch (error) {
      console.error(`Failed to process file ${file.path}:`, error);
      throw error;
    }
  }
}

export function combineResults(
  results: IntegrationCallbackResult[],
): IntegrationCallbackResult {
  const success = results.every((r) => r.success);
  const messages = results.map((r) => r.message).filter(Boolean);
  const installedPackages = results.flatMap((r) => r.installedPackages || []);
  const createdFiles = results.flatMap((r) => r.createdFiles || []);
  const errors = results.flatMap((r) => r.errors || []);

  return {
    success,
    message: messages.join("; "),
    installedPackages,
    createdFiles,
    errors,
  };
}

async function generateFiles(
  integrationKey: IntegrationKey,
): Promise<FileItem[]> {
  const dataDir = path.join(
    process.cwd(),
    `src/integrations/${integrationKey}/data`,
  );

  const checkResult = await runCommand("test", ["-d", dataDir]);

  if (!checkResult.success) {
    console.log(`No data directory found for ${integrationKey}`);
    return [];
  }

  const findResult = await runCommand("find", [dataDir, "-type", "f"]);

  if (!findResult.success) {
    console.error(`Failed to list files for ${integrationKey}`);
    return [];
  }

  const files = findResult.stdout.trim().split("\n").filter(Boolean);
  const specs: FileItem[] = [];

  for (const filePath of files) {
    const relativePath = filePath.replace(`${dataDir}/`, "");
    let type: FileItem["type"];

    if (filePath.endsWith(".txt")) {
      type = "llm_instruction";
    } else if (filePath.endsWith(".hbs")) {
      type = "handlebars";
    } else {
      type = "copy";
    }

    // Read the file content
    const readResult = await runCommand("cat", [filePath]);

    if (!readResult.success) {
      console.error(`Failed to read file ${filePath}`);
      continue;
    }

    if (type === "handlebars") {
      const template = readResult.stdout;
      const variables = getVariablesFromTemplate(template);
      specs.push({
        type,
        path: relativePath,
        template,
        variables,
      });
    } else {
      specs.push({
        type,
        path: relativePath,
        content: readResult.stdout,
      });
    }
  }

  return specs;
}
