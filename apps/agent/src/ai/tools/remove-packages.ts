import { runCommand } from "@/ai/utils/commands";
import { WORKSPACE_DIR } from "@/lib/constants";
import { Logger } from "@/lib/logger";
import { z } from "zod";
import { createTool } from "../utils/tools";

export const removePackagesTool = createTool({
  name: "remove_packages",
  description: "Use to remove node packages",
  whenToUse: "When you need to remove node packages.",
  inputSchema: z.object({
    packages: z.string().array(),
  }),
  outputSchema: z.discriminatedUnion("success", [
    z.object({
      success: z.literal(true),
      packages: z.string().array(),
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
      tags: ["removePackagesTool"],
      extra: {
        projectId: project.id,
        versionId: version.id,
        input,
      },
    });

    logger.info(`Removing packages: ${input.packages.join(", ")}`);

    const { stderr, exitCode, success } = await runCommand(
      "bun",
      ["remove", ...input.packages],
      {
        cwd: WORKSPACE_DIR,
      },
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
      packages: input.packages,
    };
  },
});
