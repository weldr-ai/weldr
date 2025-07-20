import path from "node:path";
import { applyEdit } from "@/ai/utils/apply-edit";
import { runCommand } from "@/ai/utils/commands";
import { WORKSPACE_DIR } from "@/lib/constants";
import type { WorkflowContext } from "@/workflow/context";

import { and, db } from "@weldr/db";
import { integrations } from "@weldr/db/schema";
import { Logger } from "@weldr/shared/logger";
import type { Integration, IntegrationKey } from "@weldr/shared/types";
import { integrationRegistry } from "../registry";
import type {
  ExtractOptionsForKey,
  FileItem,
  IntegrationCallbackResult,
  IntegrationDefinition,
} from "../types";
import { installPackages, updatePackageJsonScripts } from "./packages";
import { getVariablesFromTemplate } from "./templates";

export async function defineIntegration<K extends IntegrationKey>(
  props: IntegrationDefinition<K>,
): Promise<IntegrationDefinition<K>> {
  return {
    ...props,
    preInstall: async ({
      context,
      integration,
    }: {
      context: WorkflowContext;
      integration: Integration;
    }) => {
      const options = integration?.options as
        | ExtractOptionsForKey<K>
        | undefined;

      const packages = (await props.packages?.(context, options)) ?? [];

      const scripts = (await props.scripts?.(context, options)) ?? [];

      const results = await Promise.all([
        installPackages(packages),
        updatePackageJsonScripts(scripts),
        props.preInstall?.({ context, integration }),
      ]);
      return combineResults(results.filter((r) => r !== undefined));
    },
  } as unknown as IntegrationDefinition<K>;
}

export async function applyIntegrationFiles({
  integration,
  context,
}: {
  integration: Integration;
  context: WorkflowContext;
}): Promise<void> {
  const files = await generateFiles({
    integration,
    context,
  });

  for (const file of files) {
    const targetPath = file.targetPath.replace(/\.(txt|hbs)$/, "");

    const readResult = await runCommand("cat", [file.sourcePath], {
      cwd: WORKSPACE_DIR,
    });

    if (!readResult.success) {
      console.error(
        `Failed to read file ${file.sourcePath}: ${readResult.stderr}`,
      );
      continue;
    }

    try {
      switch (file.type) {
        case "copy": {
          const writeResult = await runCommand("tee", [targetPath], {
            stdin: file.content,
            cwd: WORKSPACE_DIR,
          });
          if (writeResult.success) {
            console.log(
              `Successfully processed and wrote ${file.sourcePath} to ${targetPath}`,
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
            cwd: WORKSPACE_DIR,
          });

          if (!originalContentResult.success) {
            console.error(`Failed to read target file ${targetPath}`);
            continue;
          }

          const updatedContent = await applyEdit({
            originalCode: originalContentResult.stdout,
            editInstructions: file.content,
          });

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
        case "handlebars": {
          // For handlebars files, we need to process the template with variables
          // This would typically involve rendering the template with context variables
          const writeResult = await runCommand("tee", [targetPath], {
            stdin: file.template,
            cwd: WORKSPACE_DIR,
          });
          if (writeResult.success) {
            console.log(
              `Successfully processed handlebars template ${file.sourcePath} to ${targetPath}`,
            );
          } else {
            throw new Error(
              `Failed to write processed handlebars content to ${targetPath}: ${writeResult.stderr}`,
            );
          }
          break;
        }
      }
    } catch (error) {
      console.error(`Failed to process file ${file.sourcePath}:`, error);
      throw error;
    }
  }
}

export async function getIntegrations(input: {
  keys: IntegrationKey[];
  context: WorkflowContext;
}) {
  const project = input.context.get("project");
  const user = input.context.get("user");
  Logger.info(`Resolved dependencies: ${input.keys.join(", ")}`);

  const integrationsToInstall: Integration[] = [];

  await db.transaction(async (tx) => {
    for (const key of input.keys) {
      const integrationDefinition = integrationRegistry.get(key);

      const integrationTemplate = await tx.query.integrationTemplates.findFirst(
        {
          where: (t, { eq }) => eq(t.key, key),
        },
      );

      if (!integrationTemplate) {
        throw new Error(`Integration template not found: ${key}`);
      }

      const doesIntegrationExist = await tx.query.integrations.findFirst({
        where: (t, { eq }) =>
          and(
            eq(t.projectId, project.id),
            eq(t.integrationTemplateId, integrationTemplate.id),
          ),
      });

      if (
        doesIntegrationExist &&
        integrationDefinition.allowMultiple === false
      ) {
        integrationsToInstall.push(doesIntegrationExist as Integration);
        continue;
      }

      const requiresConfiguration = integrationDefinition.variables?.some(
        (v) => v.source === "user" && v.isRequired,
      );

      if (requiresConfiguration) {
        const [integration] = await tx
          .insert(integrations)
          .values({
            key,
            projectId: project.id,
            userId: user.id,
            integrationTemplateId: integrationTemplate.id,
            status: "requires_configuration",
          })
          .returning();

        if (!integration) {
          throw new Error(`Failed to create integration: ${key}`);
        }
        integrationsToInstall.push(integration as Integration);
      } else {
        const [integration] = await tx
          .insert(integrations)
          .values({
            key,
            projectId: project.id,
            userId: user.id,
            integrationTemplateId: integrationTemplate.id,
          })
          .returning();

        if (!integration) {
          throw new Error(`Failed to create integration: ${key}`);
        }
        integrationsToInstall.push(integration as Integration);
      }
    }
  });

  return integrationsToInstall;
}

export async function installIntegrations(
  integrations: Integration[],
  context: WorkflowContext,
) {
  const addedIntegrations: IntegrationKey[] = [];
  for (const integration of integrations) {
    if (integration.status === "installed") {
      continue;
    }

    try {
      await integrationRegistry.install({
        integration,
        context,
      });
      Logger.info(`Installed ${integration.key} integration`);
      addedIntegrations.push(integration.key);
    } catch (error) {
      Logger.error(`Failed to apply ${integration.key} integration`, {
        extra: { error },
      });
      const errorMessage = `Failed to apply ${integration.key} integration: ${error instanceof Error ? error.message : "Unknown error"}`;
      return { status: "error" as const, error: errorMessage };
    }
  }
  return { status: "success" as const, addedIntegrations };
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

async function generateFiles(params: {
  integration: Integration;
  context: WorkflowContext;
}): Promise<FileItem[]> {
  const { integration, context } = params;
  const project = context.get("project");
  const hasServer = project.config.has("server");
  const hasWeb = project.config.has("web");

  let baseDataDir = path.join(
    process.cwd(),
    `src/integrations/${integration.key}`,
  );

  // Handle special case for postgresql with ORM subdirectory
  if (
    integration.key === "postgresql" &&
    integration.options &&
    typeof integration.options === "object" &&
    "orm" in integration.options &&
    typeof integration.options.orm === "string"
  ) {
    baseDataDir = path.join(baseDataDir, integration.options.orm);
  }

  baseDataDir = path.join(baseDataDir, "data");

  const checkResult = await runCommand("test", ["-d", baseDataDir]);

  if (!checkResult.success) {
    console.log(`No data directory found for ${baseDataDir}`);
    return [];
  }

  const files: FileItem[] = [];

  // Process server files if project includes server and integration has server data
  if (hasServer) {
    const serverPath = path.join(baseDataDir, "server");
    const serverFiles = await processDirectoryFiles(serverPath);
    files.push(...serverFiles);
  }

  // Process web files if project includes web and integration has web data
  if (hasWeb) {
    const webPath = path.join(baseDataDir, "web");
    const webFiles = await processDirectoryFiles(webPath);
    files.push(...webFiles);
  }

  return files;
}

async function processDirectoryFiles(sourcePath: string): Promise<FileItem[]> {
  const findResult = await runCommand("find", [sourcePath, "-type", "f"]);
  if (!findResult.success) {
    return [];
  }

  const files: FileItem[] = [];

  const filePaths = findResult.stdout.trim().split("\n").filter(Boolean);

  for (const filePath of filePaths) {
    if (typeof filePath !== "string") continue;

    const relativePath = filePath.replace(`${sourcePath}/`, "");
    const targetPath = path.join(WORKSPACE_DIR, relativePath);

    const file = await processFile(filePath, targetPath);
    files.push(...file);
  }

  return files;
}

async function processFile(
  filePath: string,
  targetPath: string,
): Promise<FileItem[]> {
  const files: FileItem[] = [];

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
    throw new Error(`Failed to read file ${filePath}`);
  }

  if (type === "handlebars") {
    const template = readResult.stdout;
    const variables = getVariablesFromTemplate(template);
    files.push({
      type,
      sourcePath: filePath,
      targetPath,
      template,
      variables,
    });
  } else {
    files.push({
      type,
      sourcePath: filePath,
      targetPath,
      content: readResult.stdout,
    });
  }

  return files;
}
