import { db, eq } from "@weldr/db";
import { projects } from "@weldr/db/schema";
import { Logger } from "@weldr/shared/logger";
import {
  integrationKeySchema,
  integrationStatusSchema,
} from "@weldr/shared/validators/integrations";
import { z } from "zod";
import {
  getIntegrations,
  installIntegrations,
} from "@/integrations/utils/integration-core";
import { createTool } from "../utils/tools";

export const initProjectTool = createTool({
  name: "init_project",
  description:
    "Initializes a new project with the specified title and integrations. Sets up project structure, installs dependencies, and configures the codebase based on the integration keys provided.",
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
      status: z.literal("success"),
      message: z.string(),
    }),
    z.object({
      status: z.literal("error"),
      error: z.string(),
    }),
    z.object({
      status: z.literal("requires_configuration"),
      integrations: z.array(
        z.object({
          id: z.string(),
          key: integrationKeySchema,
          status: integrationStatusSchema,
        }),
      ),
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
      return { status: "error" as const, error };
    }

    const config: Set<"database" | "authentication" | "server" | "web"> =
      new Set();

    for (const key of input.keys) {
      if (key === "postgresql") {
        config.add("database");
      } else if (key === "better-auth") {
        config.add("authentication");
      } else if (key === "orpc") {
        config.add("server");
      } else if (key === "tanstack-start") {
        config.add("web");
      }
    }

    context.set("project", {
      ...updatedProject,
      config,
    });

    const streamWriter = global.sseConnections?.get(
      context.get("version").chatId,
    );

    if (streamWriter) {
      await streamWriter.write({
        type: "update_project",
        data: {
          title: input.title,
          initiatedAt: updatedProject.initiatedAt,
        },
      });
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
        status: "error" as const,
        error: installationResult.error,
      };
    }

    logger.info("Project initialized successfully");

    return {
      status: "success" as const,
      message: `Project initialized successfully with ${input.keys.join(", ")}`,
    };
  },
});
