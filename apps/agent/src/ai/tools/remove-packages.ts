import { runCommand } from "@/ai/utils/commands";
import { defineTool } from "@/ai/utils/tools";
import { WORKSPACE_DIR } from "@/lib/constants";
import { Logger } from "@/lib/logger";
import { z } from "zod";

export const removePackagesTool = defineTool({
  name: "remove_packages",
  description: "Use to remove node packages",
  whenToUse: "When you need to remove one or more node packages.",
  example: `<remove_packages>
  <pkgs>
    <pkg>jsonwebtoken</pkg>
    <pkg>bcrypt</pkg>
  </pkgs>
</remove_packages>`,

  inputSchema: z.object({
    pkgs: z.string().array(),
  }),

  execute: async ({ input, context }) => {
    const project = context.get("project");
    const version = context.get("version");

    // Create contextual logger with base tags and extras
    const logger = Logger.get({
      tags: ["removePackagesTool"],
      extra: {
        projectId: project.id,
        versionId: version.id,
        input,
      },
    });

    logger.info(`Removing packages: ${input.pkgs.join(", ")}`);

    const { stderr, exitCode, success } = await runCommand(
      "bun",
      ["remove", ...input.pkgs],
      { cwd: WORKSPACE_DIR },
    );

    if (exitCode !== 0 || !success) {
      logger.error("Failed to remove packages", {
        extra: {
          exitCode,
          stderr,
        },
      });
      return {
        success: false,
        error: stderr || "Failed to remove packages",
      };
    }

    logger.info("Packages removed successfully");

    // The caller of this tool is responsible for updating the database after removing packages.
    return {
      success: true,
      packages: input.pkgs,
    };
  },
});
