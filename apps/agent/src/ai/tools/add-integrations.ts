import { z } from "zod";

import { db } from "@weldr/db";
import { Logger } from "@weldr/shared/logger";
import { integrationCategoryKeySchema } from "@weldr/shared/validators/integration-categories";
import { createTool } from "../utils/tools";

export const addIntegrationsTool = createTool({
  name: "add_integrations",
  description:
    "Shows available integration categories that can be added to an existing initialized project.",
  whenToUse:
    "Use this tool when you need to add more integration categories to an already initialized project. It will return available categories.",
  inputSchema: z.object({
    categories: z
      .array(integrationCategoryKeySchema)
      .describe(
        "Integration categories to add to the project (e.g., 'database', 'auth', 'email').",
      ),
  }),
  outputSchema: z.discriminatedUnion("status", [
    z.object({
      status: z.literal("awaiting_config"),
      categories: z.array(integrationCategoryKeySchema),
    }),
    z.object({
      status: z.literal("failed"),
      error: z.string(),
    }),
  ]),
  execute: async ({ input, context }) => {
    const project = context.get("project");
    const version = context.get("version");

    const logger = Logger.get({
      projectId: project.id,
      versionId: version?.id,
      input,
    });

    logger.info(`Adding categories: ${input.categories.join(", ")}`);

    if (!project.initiatedAt) {
      const error =
        "Cannot add integrations to an uninitialized project. Use the init_project tool first.";
      logger.error(error);
      return { status: "failed" as const, error };
    }

    const requestedCategories = await db.query.integrationCategories.findMany({
      where: (table, { inArray }) => inArray(table.key, input.categories),
    });

    if (requestedCategories.length === 0) {
      const error = "No valid categories found";
      logger.error(error);
      return { status: "failed" as const, error };
    }

    const existingIntegrations = await db.query.integrations.findMany({
      where: (table, { eq }) => eq(table.projectId, project.id),
      with: {
        integrationTemplate: {
          with: {
            category: {
              columns: {
                key: true,
              },
            },
          },
        },
      },
    });

    const existingCategoryKeys = new Set(
      existingIntegrations.map(
        (integration) => integration.integrationTemplate.category.key,
      ),
    );

    const availableCategories = requestedCategories.filter(
      (category) => !existingCategoryKeys.has(category.key),
    );

    logger.info(
      `Found ${availableCategories.length} available categories for user selection`,
    );

    return {
      status: "awaiting_config" as const,
      categories: availableCategories.map((category) => category.key),
    };
  },
});
