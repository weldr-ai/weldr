import { z } from "zod";

import { Logger } from "@weldr/shared/logger";

import { runCommand } from "@/lib/commands";
import { WORKSPACE_DIR } from "@/lib/constants";
import { createTool } from "./utils";

export const listDirTool = createTool({
  name: "list_dir",
  description: "Displays a list of files and directories in a specified path.",
  whenToUse:
    "When you need to explore the file system and understand the directory structure.",
  inputSchema: z.object({
    path: z
      .string()
      .optional()
      .describe("The subdirectory to view, relative to the project root."),
    level: z
      .number()
      .int()
      .positive()
      .optional()
      .default(2)
      .describe("The maximum depth of the directory tree to display."),
    directoriesOnly: z
      .boolean()
      .optional()
      .default(false)
      .describe("If true, only directories will be listed."),
  }),
  outputSchema: z.discriminatedUnion("success", [
    z.object({
      success: z.literal(true),
      tree: z.string(),
    }),
    z.object({
      success: z.literal(false),
      error: z.string(),
    }),
  ]),
  execute: async ({ input, context }) => {
    const { path, level, directoriesOnly } = input;
    const project = context.get("project");
    const version = context.get("version");

    const logger = Logger.get({
      projectId: project.id,
      versionId: version.id,
      input,
    });

    logger.info("Listing directory contents");

    if (path?.includes("..")) {
      logger.error("Invalid path: Directory traversal is not allowed", {
        extra: {
          path,
        },
      });
      return {
        success: false as const,
        error: "Invalid path: Directory traversal is not allowed.",
      };
    }

    const targetPath = path ? `${WORKSPACE_DIR}/${path}` : WORKSPACE_DIR;

    const args = [
      "-L",
      level.toString(),
      "--charset=ascii",
      "--noreport",
      // Exclude common large/unnecessary directories
      "-I",
      "node_modules|.git|.next|dist|build|.turbo|out|pnpm-lock.yaml|bun.lockb",
    ];

    if (directoriesOnly) {
      args.push("-d");
    }

    args.push(targetPath);

    const { stdout, stderr, exitCode } = await runCommand("tree", args, {
      cwd: WORKSPACE_DIR,
    });

    if (exitCode !== 0) {
      logger.error("Failed to execute tree command", {
        extra: {
          exitCode,
          stderr,
        },
      });
      if (stderr?.includes("not found") || stderr?.includes("no such file")) {
        return {
          success: false as const,
          error:
            "`tree` command is not installed or not found in PATH. Please install it to use this tool.",
        };
      }
      return {
        success: false as const,
        error: stderr || "Failed to execute `tree` command.",
      };
    }

    // The first line of `tree` output is the path itself.
    // We replace it with `.` for a cleaner, relative representation.
    const treeLines = stdout.trim().split("\n");
    treeLines[0] = path || ".";
    const cleanedOutput = treeLines.join("\n");

    logger.info("Directory listing completed successfully", {
      extra: {
        exitCode,
        linesCount: treeLines.length,
      },
    });

    return {
      success: true as const,
      tree: cleanedOutput,
    };
  },
});
