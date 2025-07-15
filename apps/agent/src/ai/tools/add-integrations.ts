import { and, db, eq } from "@weldr/db";
import { integrations } from "@weldr/db/schema";
import { Logger } from "@weldr/shared/logger";
import type { IntegrationKey } from "@weldr/shared/types";
import { integrationKeySchema } from "@weldr/shared/validators/integrations";
import { z } from "zod";
import { integrationRegistry } from "../../integrations/registry";
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
        await integrationRegistry.install(integrationKey, context);

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
