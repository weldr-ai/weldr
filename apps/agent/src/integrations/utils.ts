import { applyEdit } from "@/ai/utils/apply-edit";
import { runCommand } from "@/ai/utils/commands";
import { WORKSPACE_DIR } from "@/lib/constants";
import type { IntegrationKey } from "@weldr/shared/types";
import Handlebars from "handlebars";
import type {
  FileItem,
  IntegrationCallbackResult,
  IntegrationDefinition,
} from "./types";

export async function installPackages({
  packages,
  isDev = false,
}: {
  packages: Record<string, string>;
  isDev?: boolean;
}): Promise<IntegrationCallbackResult> {
  const packageEntries = Object.entries(packages);
  if (packageEntries.length === 0) {
    return { success: true, message: "No packages to install" };
  }

  const installCommand = isDev ? "bun add --dev" : "bun add";
  const packageStrings = packageEntries.map(([name, version]) =>
    version ? `${name}@${version}` : name,
  );

  const result = await runCommand(
    "sh",
    ["-c", `${installCommand} ${packageStrings.join(" ")}`],
    {
      cwd: WORKSPACE_DIR,
    },
  );

  if (result.success) {
    return {
      success: true,
      message: `Successfully installed packages: ${packageStrings.join(", ")}`,
      installedPackages: packageStrings,
    };
  }

  return {
    success: false,
    message: `Failed to install packages: ${result.stderr}`,
    errors: [result.stderr],
  };
}

export async function removePackages(
  packageNames: string[],
): Promise<IntegrationCallbackResult> {
  const result = await runCommand(
    "sh",
    ["-c", `bun remove ${packageNames.join(" ")}`],
    {
      cwd: WORKSPACE_DIR,
    },
  );

  if (result.success) {
    return {
      success: true,
      message: `Successfully removed packages: ${packageNames.join(", ")}`,
    };
  }

  return {
    success: false,
    message: `Failed to remove packages: ${result.stderr}`,
    errors: [result.stderr],
  };
}

export async function updatePackageJsonScripts(
  scripts: Record<string, string>,
): Promise<IntegrationCallbackResult> {
  try {
    const packageJson = await runCommand("cat", ["package.json"], {
      cwd: WORKSPACE_DIR,
    });

    if (!packageJson.success) {
      return {
        success: false,
        message: `Failed to read package.json: ${packageJson.stderr}`,
        errors: [packageJson.stderr],
      };
    }

    const packageJsonContent = JSON.parse(packageJson.stdout);

    if (scripts) {
      packageJsonContent.scripts = {
        ...packageJsonContent.scripts,
        ...scripts,
      };
    }

    await runCommand("echo", [JSON.stringify(packageJsonContent, null, 2)], {
      cwd: WORKSPACE_DIR,
    });

    return {
      success: true,
      message: "Successfully updated package.json scripts",
    };
  } catch (error) {
    console.error("Error updating package.json:", error);
    return {
      success: false,
      message: `Failed to update package.json scripts: ${error instanceof Error ? error.message : String(error)}`,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}

export async function runBunScript(
  script: string,
): Promise<IntegrationCallbackResult> {
  const result = await runCommand("bun", ["run", script], {
    cwd: WORKSPACE_DIR,
  });

  if (result.success) {
    return {
      success: true,
      message: `Successfully ran script: ${script}`,
    };
  }

  return {
    success: false,
    message: `Failed to run script ${script}: ${result.stderr}`,
    errors: [result.stderr],
  };
}

export async function createDirectory(
  path: string,
): Promise<IntegrationCallbackResult> {
  const result = await runCommand("mkdir", ["-p", path], {
    cwd: WORKSPACE_DIR,
  });

  if (result.success) {
    return {
      success: true,
      message: `Successfully created directory: ${path}`,
      createdFiles: [path],
    };
  }

  return {
    success: false,
    message: `Failed to create directory ${path}: ${result.stderr}`,
    errors: [result.stderr],
  };
}

export async function fileExists(path: string): Promise<boolean> {
  const result = await runCommand("test", ["-f", path], {
    cwd: WORKSPACE_DIR,
  });
  return result.success;
}

export async function directoryExists(path: string): Promise<boolean> {
  const result = await runCommand("test", ["-d", path], {
    cwd: WORKSPACE_DIR,
  });
  return result.success;
}

export async function renameDirectory(
  oldPath: string,
  newPath: string,
): Promise<boolean> {
  const result = await runCommand("mv", [oldPath, newPath], {
    cwd: WORKSPACE_DIR,
  });
  return result.success;
}

export async function removeDirectory(path: string): Promise<boolean> {
  const result = await runCommand("rm", ["-rf", path], { cwd: WORKSPACE_DIR });
  return result.success;
}

export async function replaceTextInFiles(
  searchPattern: string,
  replacement: string,
): Promise<boolean> {
  const findCmd = `find ${WORKSPACE_DIR} -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.json" \\) -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/dist/*" -not -path "*/boilerplates/*" -exec sed -i.bak 's|${searchPattern}|${replacement}|g' {} \\;`;

  const result = await runCommand("sh", ["-c", findCmd], {
    cwd: WORKSPACE_DIR,
  });

  if (result.success) {
    // Remove backup files
    const cleanupCmd = `find ${WORKSPACE_DIR} -name "*.bak" -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/dist/*" -not -path "*/boilerplates/*" -delete`;
    await runCommand("sh", ["-c", cleanupCmd], { cwd: WORKSPACE_DIR });
  }

  return result.success;
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

function getVariablesFromTemplate(template: string): Record<string, string> {
  try {
    const ast = Handlebars.parse(template);
    const variables: Record<string, string> = {};

    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    function traverseNode(node: any) {
      if (!node) return;

      if (node.type === "MustacheStatement" || node.type === "SubExpression") {
        if (node.path && node.path.type === "PathExpression") {
          const varName = node.path.original;
          if (varName && !isHandlebarsHelper(varName)) {
            variables[varName] = "string";
          }
        }
      } else if (node.type === "BlockStatement") {
        if (node.path && node.path.type === "PathExpression") {
          const varName = node.path.original;
          if (varName && !isHandlebarsHelper(varName)) {
            variables[varName] = "string";
          }
        }

        if (node.program?.body) {
          node.program.body.forEach(traverseNode);
        }

        if (node.inverse?.body) {
          node.inverse.body.forEach(traverseNode);
        }
      }

      if (node.params) {
        for (const param of node.params) {
          if (param.type === "PathExpression") {
            const varName = param.original;
            if (varName && !isHandlebarsHelper(varName)) {
              variables[varName] = "string";
            }
          }
        }
      }

      // Recursively traverse child nodes
      if (node.body) {
        node.body.forEach(traverseNode);
      }
    }

    // Start traversing from root statements
    if (ast.body) {
      ast.body.forEach(traverseNode);
    }

    return variables;
  } catch (error) {
    console.error("Error parsing handlebars template:", error);
    return {};
  }
}

/**
 * Check if a variable name is a built-in handlebars helper
 */
function isHandlebarsHelper(name: string): boolean {
  const builtinHelpers = [
    "if",
    "unless",
    "each",
    "with",
    "lookup",
    "log",
    "blockHelperMissing",
    "helperMissing",
    "this",
    "else",
  ];
  return builtinHelpers.includes(name);
}

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

async function generateFiles(
  integrationKey: IntegrationKey,
): Promise<FileItem[]> {
  const dataDir = `${integrationKey}/data`;

  // Check if data directory exists
  const checkResult = await runCommand("test", ["-d", dataDir], {
    cwd: "apps/agent/src/integrations",
  });
  if (!checkResult.success) {
    console.log(`No data directory found for ${integrationKey}`);
    return [];
  }

  // Recursively find all files in the data directory
  const findResult = await runCommand("find", [dataDir, "-type", "f"], {
    cwd: "apps/agent/src/integrations",
  });
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
    const readResult = await runCommand("cat", [filePath], {
      cwd: "apps/agent/src/integrations",
    });

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

export async function applyIntegrationFiles(
  integration: IntegrationDefinition,
): Promise<void> {
  for (const file of integration.files) {
    let targetPath = file.path.replace(".txt", "");

    try {
      switch (file.type) {
        case "copy": {
          const copyResult = await runCommand("cp", [file.path, targetPath], {
            cwd: WORKSPACE_DIR,
          });

          if (copyResult.success) {
            console.log(`Successfully copied ${file.path} to ${targetPath}`);
          } else {
            throw new Error(
              `Failed to copy ${file.path} to ${targetPath}: ${copyResult.stderr}`,
            );
          }
          break;
        }
        case "llm_instruction": {
          const editInstructionsResult = await runCommand("cat", [file.path], {
            cwd: WORKSPACE_DIR,
          });

          if (!editInstructionsResult.success) {
            console.warn(
              `Could not read instructions file ${file.path}, skipping...`,
            );
            continue;
          }

          const originalContentResult = await runCommand("cat", [targetPath], {
            cwd: WORKSPACE_DIR,
          });

          if (!originalContentResult.success) {
            console.error(`Failed to read target file ${targetPath}`);
            continue;
          }

          const updatedContent = await applyEdit(
            originalContentResult.stdout,
            editInstructionsResult.stdout,
          );

          const doesSrcExist = await directoryExists("src");

          if (
            !doesSrcExist &&
            targetPath.startsWith("src/") &&
            integration.location === "frontend"
          ) {
            targetPath = targetPath.replace("src/", "web/");
          }

          if (
            !doesSrcExist &&
            targetPath.startsWith("src/") &&
            integration.location === "backend"
          ) {
            targetPath = targetPath.replace("src/", "server/");
          }

          const writeResult = await runCommand("tee", [targetPath], {
            stdin: updatedContent,
            cwd: WORKSPACE_DIR,
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
