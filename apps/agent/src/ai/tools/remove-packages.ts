import { z } from "zod";

import { Logger } from "@weldr/shared/logger";

import { runCommand } from "@/lib/commands";
import { Git } from "@/lib/git";
import { createTool } from "./utils";

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
    const branch = context.get("branch");

    const logger = Logger.get({
      projectId: project.id,
      versionId: branch.headVersion.id,
      input,
    });

    logger.info(`Removing packages: ${input.packages.join(", ")}`);

    const workspaceDir = Git.getBranchWorkspaceDir(branch.id, branch.isMain);

    const { stderr, exitCode, success } = await runCommand(
      "bun",
      ["remove", ...input.packages],
      {
        cwd: workspaceDir,
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
        success: false as const,
        error: stderr || "Failed to remove packages",
      };
    }

    logger.info("Packages removed successfully");

    // The caller of this tool is responsible for updating the database after removing packages.
    return {
      success: true as const,
      packages: input.packages,
    };
  },
});
