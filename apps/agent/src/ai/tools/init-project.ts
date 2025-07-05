import { SCRIPTS_DIR, WORKSPACE_DIR } from "@/lib/constants";
import { db, eq } from "@weldr/db";
import { projects } from "@weldr/db/schema";
import { Logger } from "@weldr/shared/logger";
import { z } from "zod";
import { runCommand } from "../utils/commands";
import { createTool } from "../utils/tools";

export const initProjectTool = createTool({
  name: "init_project",
  description: "Initializes a new project.",
  whenToUse:
    "When you need to initialize a new project. You can specify the project title and type.",
  inputSchema: z.object({
    title: z.string().describe("The project title."),
    type: z
      .enum(["full-stack", "server-only", "web-only"])
      .describe("The project configuration."),
  }),
  outputSchema: z.discriminatedUnion("success", [
    z.object({
      success: z.literal(true),
      config: z.enum(["full-stack", "server-only", "web-only"]),
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

    logger.info(`Wiping workspace directory: ${WORKSPACE_DIR}`);
    await runCommand("rm", ["-rf", WORKSPACE_DIR]);

    const { exitCode, stderr, success } = await runCommand("bash", [
      `${SCRIPTS_DIR}/init-project.sh`,
      input.type,
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

    const [updatedProject] = await db
      .update(projects)
      .set({
        title: input.title,
        config: {
          server: input.type === "full-stack" || input.type === "server-only",
          client: input.type === "full-stack" || input.type === "web-only",
        },
        initiatedAt: new Date(),
      })
      .where(eq(projects.id, project.id))
      .returning();

    if (!updatedProject) {
      const error = "Failed to initialize project: Project not found";
      logger.error(error);
      return { success: false, error };
    }

    context.set("project", updatedProject);

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

    return { success: true, config: input.type };
  },
});
