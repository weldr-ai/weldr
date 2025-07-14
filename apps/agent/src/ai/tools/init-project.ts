import { SCRIPTS_DIR, WORKSPACE_DIR } from "@/lib/constants";
import { db, eq, inArray } from "@weldr/db";
import { integrationTemplates, integrations, projects } from "@weldr/db/schema";
import { Logger } from "@weldr/shared/logger";
import { z } from "zod";
import { runCommand } from "../utils/commands";
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
      .array(z.enum(["backend", "frontend"]))
      .describe(
        "The frontend/backend integration keys to determine project type: backend (backend), frontend (frontend)",
      ),
  }),
  outputSchema: z.discriminatedUnion("success", [
    z.object({
      success: z.literal(true),
      config: z.enum([
        "full-stack",
        "standalone-backend",
        "standalone-frontend",
      ]),
    }),
    z.object({
      success: z.literal(false),
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

    logger.info(`Initializing project: ${input.title}`);

    // Determine project type based on integrations
    const hasBackend = input.keys.includes("backend");
    const hasFrontend = input.keys.includes("frontend");

    const projectType =
      hasBackend && hasFrontend
        ? "full-stack"
        : hasBackend
          ? "standalone-backend"
          : "standalone-frontend";

    logger.info(`Determined project type: ${projectType}`);

    logger.info(`Wiping workspace directory: ${WORKSPACE_DIR}`);
    await runCommand("rm", ["-rf", WORKSPACE_DIR]);

    const { exitCode, stderr, success } = await runCommand("bash", [
      `${SCRIPTS_DIR}/init-project.sh`,
      projectType,
    ]);

    if (exitCode !== 0 || !success) {
      const error = `Failed to initialize project: ${stderr || "Unknown error"}`;
      logger.error(error, {
        extra: {
          exitCode,
          stderr,
        },
      });
      return { success: false, error };
    }

    const integrationTemplatesResult =
      await db.query.integrationTemplates.findMany({
        where: inArray(integrationTemplates.key, input.keys),
      });

    await db.insert(integrations).values(
      integrationTemplatesResult.map((integrationTemplate) => ({
        projectId: project.id,
        integrationTemplateId: integrationTemplate.id,
        name: integrationTemplate.name,
        userId: project.userId,
      })),
    );

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
      return { success: false, error };
    }

    context.set("project", {
      ...updatedProject,
      type: projectType,
    });

    const streamWriter = global.sseConnections?.get(
      context.get("version").chatId,
    );

    if (streamWriter) {
      await streamWriter.write({
        type: "update_project",
        data: {
          title: updatedProject.title ?? undefined,
          initiatedAt: updatedProject.initiatedAt,
        },
      });
    }

    logger.info("Project initialized successfully");

    return { success: true, config: projectType };
  },
});
