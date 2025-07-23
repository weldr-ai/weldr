import { z } from "zod";
import { createIntegrations } from "@/integrations/utils/create-integrations";
import { installQueuedIntegrations } from "@/integrations/utils/queue-installer";
import { validateDependencies } from "@/integrations/utils/validate-dependencies";

import { Logger } from "@weldr/shared/logger";
import type { IntegrationKey, IntegrationStatus } from "@weldr/shared/types";
import {
  integrationKeySchema,
  integrationStatusSchema,
} from "@weldr/shared/validators/integrations";
import { createTool } from "../utils/tools";

export const addIntegrationsTool = createTool({
  name: "add_integrations",
  description: "Adds integrations to an existing initialized project.",
  whenToUse:
    "Use this tool when you need to add integrations to an already initialized project. The project must be initialized first using the init_project tool.",
  inputSchema: z.object({
    keys: z
      .array(integrationKeySchema)
      .describe("The integration keys to add."),
  }),
  outputSchema: z.discriminatedUnion("status", [
    z.object({
      status: z.literal("awaiting_config"),
      integrations: z
        .object({
          id: z.string(),
          key: integrationKeySchema,
          status: integrationStatusSchema,
        })
        .array(),
    }),

    z.object({
      status: z.literal("completed"),
      integrations: z
        .object({
          id: z.string(),
          key: integrationKeySchema,
          status: integrationStatusSchema,
        })
        .array(),
    }),
    z.object({
      status: z.literal("failed"),
      error: z.string(),
    }),
  ]),
  execute: async ({ input, context }) => {
    const project = context.get("project");
    const version = context.get("version");
    const streamWriter = global.sseConnections?.get(version.chatId);

    if (!streamWriter) {
      throw new Error("Stream writer not found");
    }

    const logger = Logger.get({
      projectId: project.id,
      versionId: version?.id,
      input,
    });

    logger.info(`Processing integrations: ${input.keys.join(", ")}`);

    if (!project.initiatedAt) {
      const error =
        "Cannot add integrations to an uninitialized project. Use the init_project tool first.";
      logger.error(error);
      return { status: "failed" as const, error };
    }

    const dependencyValidation = await validateDependencies(
      input.keys,
      context,
    );

    if (!dependencyValidation.isValid) {
      const error = `Dependency validation failed: ${dependencyValidation.errors.join(", ")}`;
      logger.error(error);
      return { status: "failed" as const, error };
    }

    const createdIntegrations = await createIntegrations(input.keys, context);

    if (createdIntegrations.some((i) => i.status === "awaiting_config")) {
      return {
        status: "awaiting_config" as const,
        integrations: createdIntegrations.map((i) => ({
          id: i.id,
          key: i.key,
          status: i.status,
        })),
      };
    }

    const installationResult = await installQueuedIntegrations(context);

    if (installationResult.status === "error") {
      return {
        status: "failed" as const,
        error: installationResult.error,
      };
    }

    return {
      status: "completed" as const,
      integrations: installationResult.installedIntegrations.map(
        (i: {
          id: string;
          key: IntegrationKey;
          status: IntegrationStatus;
        }) => ({
          id: i.id,
          key: i.key,
          status: i.status,
        }),
      ),
    };
  },
});
