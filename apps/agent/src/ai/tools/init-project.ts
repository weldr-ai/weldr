import { z } from "zod";

import { db, eq } from "@weldr/db";
import { projects } from "@weldr/db/schema";
import { Logger } from "@weldr/shared/logger";
import { integrationCategoryKeySchema } from "@weldr/shared/validators/integration-categories";
import { createTool } from "../utils/tools";

export const initProjectTool = createTool({
  name: "init_project",
  description:
    "Initializes a new project with the specified title and integration categories.",
  whenToUse:
    "Use this tool when you need to initialize a new project from scratch. Specify the categories of integrations needed and the system will present recommended integrations for each category.",
  inputSchema: z.object({
    title: z.string().describe("The title/name of the project"),
    categories: z
      .array(integrationCategoryKeySchema)
      .describe(
        "Integration categories needed for the project (e.g., 'database', 'auth', 'email').",
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

    const streamWriter = global.sseConnections?.get(version.chatId);

    if (!streamWriter) {
      const error = "Failed to initialize project: Stream writer not found";
      logger.error(error);
      throw new Error(error);
    }

    logger.info(`Initializing project: ${input.title}`);

    const [updatedProject] = await db
      .update(projects)
      .set({
        title: input.title,
        initiatedAt: new Date(),
      })
      .where(eq(projects.id, project.id))
      .returning();

    if (!updatedProject) {
      const error = "Failed to initialize project: Project not found";
      logger.error(error);
      return { status: "failed" as const, error };
    }

    context.set("project", {
      ...updatedProject,
      integrationCategories: new Set(),
    });

    await streamWriter.write({
      type: "update_project",
      data: {
        title: input.title,
        initiatedAt: updatedProject.initiatedAt,
      },
    });

    const requestedCategories = await db.query.integrationCategories.findMany({
      where: (table, { inArray }) => inArray(table.key, input.categories),
    });

    if (requestedCategories.length === 0) {
      const error = "No valid categories found";
      logger.error(error);
      return { status: "failed" as const, error };
    }

    logger.info(
      `Found ${requestedCategories.length} categories for user selection`,
    );

    return {
      status: "awaiting_config" as const,
      categories: requestedCategories.map((category) => category.key),
    };
  },
});
