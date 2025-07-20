import path from "node:path";
import Handlebars from "handlebars";
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

export async function defineIntegration<K extends IntegrationKey>(
  props: IntegrationDefinition<K>,
): Promise<IntegrationDefinition<K>> {
  return {
    ...props,
    postInstall: async ({
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
        updatePackageJsonScripts(scripts),
        installPackages(packages),
        props.postInstall?.({ context, integration }),
      ]);

      const project = context.get("project");

      context.set("project", {
        ...project,
        config: new Set([...project.config, integration.category]),
      });

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
    const readResult = await runCommand("cat", [file.sourcePath], {
      cwd: WORKSPACE_DIR,
    });

    if (!readResult.success) {
      console.error(
        `Failed to read file ${file.sourcePath}: ${readResult.stderr}`,
      );
      continue;
    }

    const targetDir = path.dirname(file.targetPath);

    const mkdirResult = await runCommand("mkdir", ["-p", targetDir], {
      cwd: WORKSPACE_DIR,
    });

    if (!mkdirResult.success) {
      throw new Error(
        `Failed to create directories for ${file.targetPath}: ${mkdirResult.stderr}`,
      );
    }

    try {
      switch (file.type) {
        case "copy": {
          if (file.content.trim().length === 0) {
            const result = await runCommand("touch", [file.targetPath], {
              cwd: WORKSPACE_DIR,
            });

            if (!result.success) {
              throw new Error(
                `Failed to create empty file ${file.targetPath}: ${result.stderr}`,
              );
            }
          } else {
            const result = await runCommand(
              "sh",
              ["-c", `cat > "${file.targetPath}"`],
              {
                stdin: file.content,
                cwd: WORKSPACE_DIR,
              },
            );

            if (!result.success) {
              throw new Error(
                `Failed to write processed content to ${file.targetPath}: ${result.stderr}`,
              );
            }
          }

          break;
        }
        case "llm_instruction": {
          const originalContentResult = await runCommand(
            "cat",
            [file.targetPath],
            {
              cwd: WORKSPACE_DIR,
            },
          );

          if (!originalContentResult.success) {
            console.error(`Failed to read target file ${file.targetPath}`);
            continue;
          }

          const updatedContent = await applyEdit({
            originalCode: originalContentResult.stdout,
            editInstructions: file.content,
          });

          const result = await runCommand(
            "sh",
            ["-c", `cat > "${file.targetPath}"`],
            {
              stdin: updatedContent,
              cwd: WORKSPACE_DIR,
            },
          );

          if (!result.success) {
            throw new Error(
              `Failed to write updated content to ${file.targetPath}: ${result.stderr}`,
            );
          }

          break;
        }
        case "handlebars": {
          const template = Handlebars.compile(file.template);

          const integrationVariables =
            integration.environmentVariableMappings.reduce(
              (acc, mapping) => {
                acc[mapping.mapTo] = mapping.environmentVariable.key;
                return acc;
              },
              {} as Record<string, string>,
            );

          const compiledContent = template(integrationVariables);

          const writeResult = await runCommand(
            "sh",
            ["-c", `cat > "${file.targetPath}"`],
            {
              stdin: compiledContent,
              cwd: WORKSPACE_DIR,
            },
          );

          if (!writeResult.success) {
            throw new Error(
              `Failed to write processed handlebars content to ${file.targetPath}: ${writeResult.stderr}`,
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
}): Promise<Integration[]> {
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
        with: {
          environmentVariableMappings: {
            with: {
              environmentVariable: true,
            },
          },
        },
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
            category: integrationTemplate.category,
            projectId: project.id,
            userId: user.id,
            integrationTemplateId: integrationTemplate.id,
            status: "requires_configuration",
          })
          .returning();

        if (!integration) {
          throw new Error(`Failed to create integration: ${key}`);
        }

        integrationsToInstall.push({
          ...integration,
          environmentVariableMappings: [],
        } as Integration);
      } else {
        const [integration] = await tx
          .insert(integrations)
          .values({
            key,
            category: integrationTemplate.category,
            projectId: project.id,
            userId: user.id,
            integrationTemplateId: integrationTemplate.id,
          })
          .returning();

        if (!integration) {
          throw new Error(`Failed to create integration: ${key}`);
        }

        integrationsToInstall.push({
          ...integration,
          environmentVariableMappings: [],
        } as Integration);
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

async function generateFiles({
  integration,
  context,
}: {
  integration: Integration;
  context: WorkflowContext;
}): Promise<FileItem[]> {
  const project = context.get("project");
  const hasFrontend = project.config.has("frontend");
  const hasBackend = project.config.has("backend");

  let baseDataDir = path.join(
    process.cwd(),
    `apps/agent/src/integrations/${integration.category}/${integration.key}`,
  );

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

  if (hasBackend) {
    const serverPath = path.join(baseDataDir, "server");
    const serverFiles = await processDirectoryFiles(serverPath, "server");
    files.push(...serverFiles);
  }

  if (hasFrontend) {
    const webPath = path.join(baseDataDir, "web");
    const webFiles = await processDirectoryFiles(webPath, "web");
    files.push(...webFiles);
  }

  return files;
}

async function processDirectoryFiles(
  sourcePath: string,
  target: "server" | "web",
): Promise<FileItem[]> {
  const findResult = await runCommand("find", [sourcePath, "-type", "f"]);
  if (!findResult.success) {
    return [];
  }

  const files: FileItem[] = [];

  const filePaths = findResult.stdout.trim().split("\n").filter(Boolean);

  for (const filePath of filePaths) {
    if (typeof filePath !== "string") continue;

    const relativePath = filePath.replace(`${sourcePath}/`, "");
    const targetPath = path.join(WORKSPACE_DIR, "apps", target, relativePath);

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

  const targetPathWithoutExtension = targetPath.replace(/\.(txt|hbs)$/, "");

  if (type === "handlebars") {
    const template = readResult.stdout;
    files.push({
      type,
      sourcePath: filePath,
      targetPath: targetPathWithoutExtension,
      template,
    });
  } else {
    files.push({
      type,
      sourcePath: filePath,
      targetPath: targetPathWithoutExtension,
      content: readResult.stdout,
    });
  }

  return files;
}
