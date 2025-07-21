import { z } from "zod";
import { getIntegrations } from "@/integrations/utils/get-integrations";
import { installIntegrations } from "@/integrations/utils/install-integrations";

import { Logger } from "@weldr/shared/logger";
import {
  integrationKeySchema,
  integrationStatusSchema,
} from "@weldr/shared/validators/integrations";
import { createTool } from "../utils/tools";

export const addIntegrationsTool = createTool({
  name: "add_integrations",
  description:
    "Adds integrations to an existing initialized project. Automatically resolves and installs dependencies before installing requested integrations.",
  whenToUse:
    "Use this tool when you need to add integrations to an already initialized project. The project must be initialized first using the init_project tool.",
  inputSchema: z.object({
    keys: z
      .array(integrationKeySchema)
      .describe("The integration keys to add."),
  }),
  outputSchema: z.discriminatedUnion("status", [
    z.object({
      status: z.literal("requires_configuration"),
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

    const integrationsToInstall = await getIntegrations({
      keys: input.keys,
      context,
    });

    if (
      integrationsToInstall.some((i) => i.status === "requires_configuration")
    ) {
      return {
        status: "requires_configuration" as const,
        integrations: integrationsToInstall.map((i) => ({
          id: i.id,
          key: i.key,
          status: i.status,
        })),
      };
    }

    const installationResult = await installIntegrations(
      integrationsToInstall,
      context,
    );

    if (installationResult.status === "error") {
      return {
        status: "failed" as const,
        error: installationResult.error,
      };
    }

    return {
      status: "completed" as const,
      integrations: integrationsToInstall.map((i) => ({
        id: i.id,
        key: i.key,
        status: i.status,
      })),
    };
  },
});
