import { runCommand } from "@/ai/utils/commands";
import { defineTool } from "@/ai/utils/tools";
import { WORKSPACE_DIR } from "@/lib/constants";
import { Logger } from "@/lib/logger";
import { z } from "zod";

export const installPackagesTool = defineTool({
  name: "install_packages",
  description: "Use to install node packages",
  whenToUse: "When you need to install one or more node packages.",
  example: `<install_packages>
  <package>
    <type>runtime</type>
    <name>express</name>
    <description>Fast, unopinionated, minimalist web framework for Node.js</description>
  </package>
  <package>
    <type>development</type>
    <name>nodemon</name>
    <description>Monitor for any changes in your node.js application and automatically restart the server</description>
  </package>
</install_packages>`,

  inputSchema: z.object({
    package: z
      .object({
        type: z.enum(["runtime", "development"]),
        name: z.string(),
        description: z.string().describe("A description of the package"),
      })
      .array(),
  }),

  execute: async ({ input, context }) => {
    const project = context.get("project");
    const version = context.get("version");

    // Create contextual logger with base tags and extras
    const logger = Logger.get({
      tags: ["installPackagesTool"],
      extra: {
        projectId: project.id,
        versionId: version.id,
      },
    });

    logger.info("Installing packages", {
      extra: {
        packages: input.package.map((pkg) => pkg.name).join(", "),
      },
    });

    const { stderr, exitCode, success } = await runCommand(
      "bun",
      ["add", ...input.package.map((pkg) => pkg.name)],
      { cwd: WORKSPACE_DIR },
    );

    if (exitCode !== 0 || !success) {
      logger.error("Failed to install packages", {
        extra: {
          error: stderr || "Failed to install packages",
        },
      });
      return {
        success: false,
        error: stderr || "Failed to install packages",
      };
    }

    logger.info("Packages installed successfully");

    // The caller of this tool is responsible for updating the database with the installed packages.
    return {
      success: true,
      packages: input.package,
    };
  },
});
