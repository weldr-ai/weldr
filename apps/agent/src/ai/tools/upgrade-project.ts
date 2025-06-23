import { runCommand } from "@/ai/utils/commands";
import { SCRIPTS_DIR } from "@/lib/constants";
import { Logger } from "@/lib/logger";
import { db, eq } from "@weldr/db";
import { projects } from "@weldr/db/schema";
import { z } from "zod";
import { createTool } from "../utils/tools";

export const upgradeProjectTool = createTool({
  name: "upgrade_project",
  description: "Upgrades a project to full-stack.",
  whenToUse: "When you need to upgrade a project to full-stack.",
  example: `<upgrade_project>
  <server>true</server>
  <client>true</client>
</upgrade_project>`,
  inputSchema: z.object({}),
  outputSchema: z.discriminatedUnion("success", [
    z.object({
      success: z.literal(true),
      server: z.boolean(),
      client: z.boolean(),
    }),
    z.object({
      success: z.literal(false),
      error: z.string(),
    }),
  ]),
  execute: async ({ context }) => {
    const project = context.get("project");
    const version = context.get("version");

    // Create contextual logger with base tags and extras
    const logger = Logger.get({
      tags: ["upgradeProjectTool"],
      extra: {
        projectId: project.id,
        versionId: version.id,
      },
    });

    if (project.config?.server && project.config?.client) {
      logger.info("Project already full-stack, returning existing config");
      return { success: true, server: true, client: true };
    }

    if (project.config?.server && !project.config?.client) {
      const { exitCode, stderr, success } = await runCommand(
        `${SCRIPTS_DIR}/update-project.sh`,
        ["web"],
      );

      if (exitCode !== 0 || !success) {
        const error = `[upgradeToFullStackTool:${
          project.id
        }] Failed to upgrade project to full-stack: ${stderr || "Unknown error"}`;
        logger.error("Failed to upgrade project to full-stack", {
          extra: { error },
        });
        return { success: false, error };
      }
    }

    if (project.config?.client && !project.config?.server) {
      const { exitCode, stderr, success } = await runCommand(
        `${SCRIPTS_DIR}/update-project.sh`,
        ["server"],
      );

      if (exitCode !== 0 || !success) {
        const error = `[upgradeToFullStackTool:${
          project.id
        }] Failed to upgrade project to full-stack: ${stderr || "Unknown error"}`;
        logger.error("Failed to upgrade project to full-stack", {
          extra: { error },
        });
        return { success: false, error };
      }
    }

    const [updatedProject] = await db
      .update(projects)
      .set({ config: { server: true, client: true } })
      .where(eq(projects.id, project.id))
      .returning();

    if (!updatedProject) {
      logger.error("Failed to upgrade project to full-stack");
      return {
        success: false,
        error: "Failed to upgrade project to full-stack",
      };
    }

    context.set("project", updatedProject);

    logger.info("Project upgraded to full-stack");

    return { success: true, server: true, client: true };
  },
});
