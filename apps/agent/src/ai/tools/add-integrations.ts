import { WORKSPACE_DIR } from "@/lib/constants";
import { and, db, eq } from "@weldr/db";
import { integrations } from "@weldr/db/schema";
import { Logger } from "@weldr/shared/logger";
import type { IntegrationKey } from "@weldr/shared/types";
import { integrationKeySchema } from "@weldr/shared/validators/integrations";
import { z } from "zod";
import { integrationRegistry } from "../../integrations/registry";
import { applyEdit } from "../utils/apply-edit";
import { runCommand } from "../utils/commands";
import { createTool } from "../utils/tools";

export const addIntegrationsTool = createTool({
  name: "add_integrations",
  description:
    "Adds integrations to an existing initialized project. Automatically sets up system-managed integrations and identifies user-managed integrations that need configuration.",
  whenToUse:
    "Use this tool when you need to add integrations to an already initialized project. The project must be initialized first using the init_project tool. For system-managed integrations (backend, frontend), this tool will upgrade the project structure, install dependencies, and configure the codebase automatically. For user-managed integrations (postgresql, better-auth), this tool will return requiresConfiguration=true and pause for user input.",
  inputSchema: z.object({
    keys: z
      .array(z.enum(["backend", "frontend", "postgresql", "better-auth"]))
      .describe("The integration keys to add."),
  }),
  outputSchema: z.discriminatedUnion("status", [
    z.object({
      status: z.literal("success"),
      addedIntegrations: z.array(
        z.object({
          integrationKey: z.string(),
          integrationName: z.string(),
          isSystemManaged: z.boolean(),
        }),
      ),
    }),
    z.object({
      status: z.literal("error"),
      error: z.string(),
    }),
    z.object({
      status: z.literal("requires_configuration"),
      keys: integrationKeySchema.array(),
    }),
  ]),
  execute: async ({ input, context }) => {
    const project = context.get("project");
    const version = context.get("version");
    const user = context.get("user");

    const logger = Logger.get({
      projectId: project.id,
      versionId: version?.id,
      input,
    });

    logger.info(`Processing integrations: ${input.keys.join(", ")}`);

    const templates = await db.query.integrationTemplates.findMany({
      where: (t, { inArray }) => inArray(t.key, input.keys),
    });

    const templateMap = new Map(templates.map((t) => [t.key, t]));

    const systemManagedKeys: IntegrationKey[] = [];
    const userManagedRequiringConfig: IntegrationKey[] = [];

    for (const key of input.keys) {
      const template = templateMap.get(key);
      if (!template) {
        logger.error(`Integration template not found: ${key}`);
        continue;
      }

      if (template.isSystemManaged) {
        systemManagedKeys.push(key);
      } else {
        userManagedRequiringConfig.push(key);
      }
    }

    if (userManagedRequiringConfig.length > 0) {
      return {
        keys: userManagedRequiringConfig,
        status: "requires_configuration",
      };
    }

    const addedIntegrations = [];

    if (!project.initiatedAt) {
      const error =
        "Project must be initialized before adding integrations. Use the init_project tool first.";
      logger.error(error);
      return { status: "error", error };
    }

    for (const integrationKey of systemManagedKeys) {
      const template = templateMap.get(integrationKey);
      if (!template) {
        logger.error(`Integration template not found: ${integrationKey}`);
        continue;
      }

      // Check if integration already exists
      const existingIntegration = await db.query.integrations.findFirst({
        where: and(
          eq(integrations.projectId, project.id),
          eq(integrations.integrationTemplateId, template.id),
        ),
      });

      if (existingIntegration) {
        logger.info(`Integration ${template.name} already exists`);
        addedIntegrations.push({
          integrationKey,
          integrationName: template.name,
          isSystemManaged: template.isSystemManaged,
        });
        continue;
      }

      // Apply integration with callback system
      try {
        await installIntegration(integrationKey);

        logger.info(`Applied ${integrationKey} integration`);

        addedIntegrations.push({
          integrationKey,
          integrationName: template.name,
          isSystemManaged: template.isSystemManaged,
        });
      } catch (error) {
        logger.error(`Failed to apply ${integrationKey} integration`, {
          extra: { error },
        });
        const errorMessage = `Failed to apply ${integrationKey} integration: ${error instanceof Error ? error.message : "Unknown error"}`;
        return { status: "error", error: errorMessage };
      }

      // Create the integration record
      try {
        await db.insert(integrations).values({
          projectId: project.id,
          userId: user.id,
          integrationTemplateId: template.id,
          name: template.name,
        });

        logger.info(`Created ${template.name} integration in database`);
      } catch (error) {
        logger.error(
          `Failed to create ${template.name} integration in database`,
          { extra: { error } },
        );
        // Continue with other integrations
      }
    }

    logger.info(
      `Successfully processed ${addedIntegrations.length} integrations`,
    );

    return {
      status: "success",
      addedIntegrations,
    };
  },
});

async function installIntegration(
  integrationKey: IntegrationKey,
): Promise<void> {
  // Get the integration definition from registry
  const integration = integrationRegistry.get(integrationKey);

  if (!integration) {
    throw new Error(`Integration definition not found for ${integrationKey}`);
  }

  // Run pre-install callback
  if (integration.preInstall) {
    try {
      const preInstallResult = await integration.preInstall();

      if (!preInstallResult.success) {
        throw new Error(`Pre-install failed: ${preInstallResult.message}`);
      }
    } catch (error) {
      console.error(
        `Pre-install callback failed for ${integrationKey}:`,
        error,
      );
      throw error;
    }
  }

  // Apply file operations from database
  await applyIntegrationFiles(integrationKey);

  // Run package installation callback
  if (integration.installPackages) {
    try {
      const installResult = await integration.installPackages();

      if (!installResult.success) {
        console.warn(
          `Package installation had issues: ${installResult.message}`,
        );
      }
    } catch (error) {
      console.error(
        `Package installation callback failed for ${integrationKey}:`,
        error,
      );
      // Don't throw here, as file operations might have succeeded
    }
  }

  // Run post-install callback
  if (integration.postInstall) {
    try {
      const postInstallResult = await integration.postInstall();

      if (!postInstallResult.success) {
        console.warn(`Post-install had issues: ${postInstallResult.message}`);
      }
    } catch (error) {
      console.error(
        `Post-install callback failed for ${integrationKey}:`,
        error,
      );
      // Don't throw here, as the main installation might have succeeded
    }
  }

  // Run validation callback
  if (integration.validate) {
    try {
      const validateResult = await integration.validate();

      if (!validateResult.success) {
        console.warn(`Validation had issues: ${validateResult.message}`);
      }
    } catch (error) {
      console.error(`Validation callback failed for ${integrationKey}:`, error);
      // Don't throw here, just log the validation issue
    }
  }
}

async function applyIntegrationFiles(
  integrationKey: IntegrationKey,
): Promise<void> {
  // Query the database for integration file configurations
  const integrationTemplate = await db.query.integrationTemplates.findFirst({
    where: (t, { eq }) => eq(t.key, integrationKey),
    with: {
      files: true,
    },
  });

  if (!integrationTemplate) {
    console.warn(`Integration template not found for ${integrationKey}`);
    return;
  }

  for (const fileConfig of integrationTemplate.files) {
    const targetPath = fileConfig.path.replace(".txt", "");

    try {
      if (fileConfig.type === "copy") {
        // Simple file copy
        const copyResult = await runCommand(
          "cp",
          [fileConfig.path, targetPath],
          {
            cwd: WORKSPACE_DIR,
          },
        );

        if (copyResult.success) {
          console.log(
            `Successfully copied ${fileConfig.path} to ${targetPath}`,
          );
        } else {
          throw new Error(
            `Failed to copy ${fileConfig.path} to ${targetPath}: ${copyResult.stderr}`,
          );
        }
      } else if (fileConfig.type === "llm_instruction") {
        // Use LLM to apply instructions
        const readInstructionsResult = await runCommand("cat", [
          fileConfig.path,
        ]);
        if (!readInstructionsResult.success) {
          console.warn(
            `Could not read instructions file ${fileConfig.path}, skipping...`,
          );
          continue;
        }
        const editInstructions = readInstructionsResult.stdout;

        const checkTargetResult = await runCommand("test", ["-f", targetPath], {
          cwd: WORKSPACE_DIR,
        });
        if (!checkTargetResult.success) {
          console.warn(`Target file ${targetPath} does not exist, skipping...`);
          continue;
        }

        // Read the current content of the target file
        const readTargetResult = await runCommand("cat", [targetPath], {
          cwd: WORKSPACE_DIR,
        });
        if (!readTargetResult.success) {
          console.error(`Failed to read target file ${targetPath}`);
          continue;
        }
        const originalContent = readTargetResult.stdout;

        // Apply the edit using the applyEdit function
        const updatedContent = await applyEdit(
          originalContent,
          editInstructions,
        );

        // Write the updated content back to the target file
        const writeResult = await runCommand("tee", [targetPath], {
          stdin: updatedContent,
          cwd: WORKSPACE_DIR,
        });

        if (writeResult.success) {
          console.log(`Successfully applied LLM edits to ${targetPath}`);
        } else {
          throw new Error(`Failed to write updated content to ${targetPath}`);
        }
      } else {
        console.warn(
          `Unknown file type ${fileConfig.type} for ${fileConfig.path}, skipping...`,
        );
      }
    } catch (error) {
      console.error(`Failed to process file ${fileConfig.path}:`, error);
      throw error;
    }
  }
}
