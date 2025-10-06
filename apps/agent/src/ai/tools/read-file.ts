import path from "node:path";
import { z } from "zod";

import { Logger } from "@weldr/shared/logger";

import { runCommand, runShell } from "@/lib/commands";
import { Git } from "@/lib/git";
import { createTool } from "./utils";

export const readFileTool = createTool({
  name: "read_file",
  description: "Use to read a single file with pagination and size safeguards",
  whenToUse:
    "When you need to inspect the contents of a file. You can specify a line range to read.",
  inputSchema: z.object({
    filePath: z
      .string()
      .describe("The relative path to the file from the project root."),
    startLine: z
      .number()
      .int()
      .positive()
      .optional()
      .default(1)
      .describe(
        "The starting line number (inclusive). Defaults to the beginning of the file.",
      ),
    endLine: z
      .number()
      .int()
      .positive()
      .optional()
      .describe(
        "The ending line number (inclusive). Defaults to the end of the file.",
      ),
    maxLines: z
      .number()
      .int()
      .positive()
      .optional()
      .default(1500)
      .describe("The maximum number of lines to read. Defaults to 1500."),
  }),
  outputSchema: z.discriminatedUnion("success", [
    z.object({
      success: z.literal(true),
      content: z.string(),
      totalLines: z.number(),
      startLine: z.number(),
      endLine: z.number(),
      truncated: z.boolean(),
    }),
    z.object({
      success: z.literal(false),
      error: z.string(),
    }),
  ]),
  execute: async ({ input, context }) => {
    const { filePath, endLine, startLine = 1, maxLines = 1000 } = input;
    const project = context.get("project");
    const branch = context.get("branch");

    const logger = Logger.get({
      projectId: project.id,
      versionId: branch.headVersion.id,
      input,
    });

    const workspaceDir = Git.getBranchWorkspaceDir(branch.id, branch.isMain);

    logger.info(`Reading file: ${filePath}`);

    // First check if file exists and get line count
    const {
      stdout: wcOutput,
      stderr: wcStderr,
      exitCode: wcExitCode,
    } = await runCommand("wc", ["-l", filePath], {
      cwd: workspaceDir,
    });

    if (wcExitCode !== 0) {
      logger.error("Failed to access file", {
        extra: {
          exitCode: wcExitCode,
          stderr: wcStderr,
        },
      });
      if (wcStderr?.includes("No such file or directory")) {
        const dir = path.dirname(filePath);
        const base = path.basename(filePath);

        // List directory to provide suggestions
        const { stdout: lsOutput } = await runCommand("ls", [dir], {
          cwd: workspaceDir,
        });

        const dirEntries = lsOutput.split("\n").filter(Boolean);

        const suggestions = dirEntries
          .filter(
            (entry) =>
              entry.toLowerCase().includes(base.toLowerCase()) ||
              base.toLowerCase().includes(entry.toLowerCase()),
          )
          .map((entry) => path.join(dir, entry));

        if (suggestions.length > 0) {
          return {
            success: false as const,
            error: `File not found: ${filePath}\n\nDid you mean one of these?\n${suggestions.join(
              "\n",
            )}`,
          };
        }
      }

      return {
        success: false as const,
        error: wcStderr || `Failed to access file ${filePath}`,
      };
    }

    const totalLines = Number.parseInt(wcOutput?.trim().split(" ")[0] || "0");

    // Calculate actual range to read
    const actualStartLine = Math.max(1, startLine);
    const actualEndLine = endLine
      ? Math.min(endLine, totalLines)
      : Math.min(actualStartLine + maxLines - 1, totalLines);

    const linesToRead = actualEndLine - actualStartLine + 1;
    const truncated = endLine
      ? false
      : linesToRead >= maxLines || actualEndLine < totalLines;

    // Use sed to read specific line range
    const sedCommand = `sed -n '${actualStartLine},${actualEndLine}p' "${filePath}"`;

    const { stdout, stderr, exitCode, success } = await runShell(sedCommand, {
      cwd: workspaceDir,
    });

    if (exitCode !== 0 || !success) {
      logger.error("Failed to read file content", {
        extra: {
          exitCode,
          stderr,
        },
      });
      return {
        success: false as const,
        error: stderr || `Failed to read file ${filePath}`,
      };
    }

    logger.info("File read successfully");

    return {
      success: true as const,
      content: stdout || "",
      totalLines,
      startLine: actualStartLine,
      endLine: actualEndLine,
      truncated,
    };
  },
});
