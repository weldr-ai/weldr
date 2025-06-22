import { SCRIPTS_DIR, WORKSPACE_DIR } from "@/lib/constants";
import { Logger } from "@/lib/logger";
import { db, eq } from "@weldr/db";
import { projects } from "@weldr/db/schema";
import { z } from "zod";
import { runCommand } from "../utils/commands";
import { createTool } from "../utils/create-tool";

export const initProjectTool = createTool({
  description: "Initializes a new project.",
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

    // Create contextual logger with base tags and extras
    const logger = Logger.get({
      tags: ["initProjectTool"],
      extra: {
        projectId: project.id,
        versionId: version?.id,
        input,
      },
    });

    logger.info(`Initializing project: ${input.title}`);

    const { exitCode, stderr, success } = await runCommand(
      "bash",
      [`${SCRIPTS_DIR}/init-project.sh`, input.type],
      {
        cwd: WORKSPACE_DIR,
      },
    );

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

    logger.info("Project initialized successfully");

    return { success: true, config: input.type };
  },
});
