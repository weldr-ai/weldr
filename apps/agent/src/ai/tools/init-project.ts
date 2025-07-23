import { z } from "zod";
import { createIntegrations } from "@/integrations/utils/create-integrations";
import { installQueuedIntegrations } from "@/integrations/utils/queue-installer";
import { validateDependencies } from "@/integrations/utils/validate-dependencies";

import { db, eq } from "@weldr/db";
import { projects } from "@weldr/db/schema";
import { Logger } from "@weldr/shared/logger";
import {
  integrationKeySchema,
  integrationStatusSchema,
} from "@weldr/shared/validators/integrations";
import { createTool } from "../utils/tools";

export const initProjectTool = createTool({
  name: "init_project",
  description:
    "Initializes a new project with the specified title and integrations.",
  whenToUse:
    "Use this tool when you need to initialize a new project from scratch. This should be done before adding any integrations to the project.",
  inputSchema: z.object({
    title: z.string().describe("The title/name of the project"),
    keys: z
      .array(integrationKeySchema)
      .describe("Integrations to install in the project."),
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

    const dependencyValidation = await validateDependencies(
      input.keys,
      context,
    );
    if (!dependencyValidation.isValid) {
      const error = `Dependency validation failed: ${dependencyValidation.errors.join(", ")}`;
      logger.error(error);
      return { status: "failed" as const, error };
    }

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
      config: new Set(),
    });

    await streamWriter.write({
      type: "update_project",
      data: {
        title: input.title,
        initiatedAt: updatedProject.initiatedAt,
      },
    });

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

    logger.info("Project initialized successfully");

    return {
      status: "completed" as const,
      integrations:
        installationResult.installedIntegrations?.map((i) => ({
          id: i.id,
          key: i.key,
          status: i.status,
        })) ?? [],
    };
  },
});
