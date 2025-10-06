import { z } from "zod";

import { Logger } from "@weldr/shared/logger";

import { runCommand } from "@/lib/commands";
import { Git } from "@/lib/git";
import { createTool } from "./utils";

export const installPackagesTool = createTool({
  name: "install_packages",
  description: "Use to install node packages",
  whenToUse: "When you need to install node packages.",
  inputSchema: z.object({
    packages: z
      .object({
        type: z.enum(["runtime", "development"]),
        name: z.string(),
        description: z.string().describe("A description of the package"),
      })
      .array(),
  }),
  outputSchema: z.discriminatedUnion("success", [
    z.object({
      success: z.literal(true),
      packages: z
        .object({
          type: z.enum(["runtime", "development"]),
          name: z.string(),
          description: z.string().describe("A description of the package"),
        })
        .array(),
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
    });

    logger.info("Installing packages", {
      extra: {
        packages: input.packages.map((pkg) => pkg.name).join(", "),
      },
    });

    const workspaceDir = Git.getBranchWorkspaceDir(branch.id, branch.isMain);

    const { stderr, exitCode, success } = await runCommand(
      "bun",
      ["add", ...input.packages.map((pkg) => pkg.name)],
      {
        cwd: workspaceDir,
      },
    );

    if (exitCode !== 0 || !success) {
      logger.error("Failed to install packages", {
        extra: {
          error: stderr || "Failed to install packages",
        },
      });
      return {
        success: false as const,
        error: stderr || "Failed to install packages",
      };
    }

    logger.info("Packages installed successfully");

    // The caller of this tool is responsible for updating the database with the installed packages.
    return {
      success: true as const,
      packages: input.packages,
    };
  },
});
