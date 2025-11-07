import { z } from "zod";

import { Logger } from "@weldr/shared/logger";
import { getBranchDir } from "@weldr/shared/state";

import { runCommand } from "@/lib/commands";
import { createTool } from "./utils";

const grepMatchSchema = z.object({
  filePath: z.string(),
  lineNumber: z.number(),
  lineText: z.string(),
  contextBefore: z.array(z.string()).optional(),
  contextAfter: z.array(z.string()).optional(),
});

export const grepTool = createTool({
  name: "grep",
  description: "Searches for a regex pattern within files in the project.",
  whenToUse: "When you need to search for a pattern in the project.",
  inputSchema: z.object({
    pattern: z.string().describe("The regex pattern to search for."),
    filePattern: z
      .string()
      .optional()
      .describe("Glob pattern for files to include (e.g., '*.ts')."),
    ignoreCase: z
      .boolean()
      .optional()
      .default(false)
      .describe("Perform a case-insensitive search."),
    wholeWord: z
      .boolean()
      .optional()
      .default(false)
      .describe("Search for whole words only."),
    maxResults: z
      .number()
      .optional()
      .default(50)
      .describe("The maximum number of matches to return."),
    contextLines: z
      .number()
      .optional()
      .default(2)
      .describe("Number of lines to show before and after each match."),
  }),
  outputSchema: z.discriminatedUnion("success", [
    z.object({
      success: z.literal(true),
      results: z.array(grepMatchSchema),
      summary: z.object({
        totalMatches: z.number(),
        filesMatched: z.number(),
        truncated: z.boolean(),
      }),
    }),
    z.object({
      success: z.literal(false),
      error: z.string(),
    }),
  ]),
  execute: async ({ input, context }) => {
    const {
      pattern,
      filePattern,
      ignoreCase,
      wholeWord,
      maxResults,
      contextLines,
    } = input;
    const project = context.get("project");
    const branch = context.get("branch");

    const logger = Logger.get({
      projectId: project.id,
      versionId: branch.headVersion.id,
      input,
    });

    logger.info(`Starting grep search for pattern: ${pattern}`);

    const branchDir = getBranchDir(project.id, branch.id);

    const args = ["--json", "--line-number", "--column"];

    if (ignoreCase) {
      args.push("--ignore-case");
    }
    if (wholeWord) {
      args.push("--word-regexp");
    }
    if (contextLines > 0) {
      args.push(`--before-context=${contextLines}`);
      args.push(`--after-context=${contextLines}`);
    }
    if (filePattern) {
      args.push("--glob", filePattern);
    }

    args.push(pattern, branchDir);

    const { stdout, stderr, exitCode } = await runCommand("rg", args, {
      cwd: branchDir,
    });

    if (exitCode === null || exitCode > 1) {
      logger.error("Failed to execute ripgrep search", {
        extra: {
          exitCode,
          stderr,
        },
      });
      return {
        success: false as const,
        error: stderr || "Failed to execute ripgrep search",
      };
    }

    const results: z.infer<typeof grepMatchSchema>[] = [];
    const filesMatched = new Set<string>();
    let totalMatches = 0;
    let truncated = false;

    if (stdout) {
      const lines = stdout.trim().split("\n");
      for (const line of lines) {
        try {
          const jsonLine = JSON.parse(line);
          if (jsonLine.type === "match") {
            totalMatches++;
            const filePath = jsonLine.data.path.text.replace(
              `${branchDir}/`,
              "",
            );
            filesMatched.add(filePath);

            if (results.length < maxResults) {
              const data = jsonLine.data;
              results.push({
                filePath,
                lineNumber: data.line_number,
                lineText: data.lines.text.trimEnd(),
                contextBefore:
                  data.lines_before?.map((l: { text: string }) =>
                    l.text.trimEnd(),
                  ) ?? [],
                contextAfter:
                  data.lines_after?.map((l: { text: string }) =>
                    l.text.trimEnd(),
                  ) ?? [],
              });
            }
          }
        } catch {
          // Ignore lines that are not valid JSON
        }
      }
    }

    truncated = totalMatches > results.length;

    logger.info("Grep search completed successfully", {
      extra: {
        totalMatches,
        filesMatched: filesMatched.size,
        truncated,
        exitCode,
      },
    });

    return {
      success: true as const,
      results,
      summary: {
        totalMatches,
        filesMatched: filesMatched.size,
        truncated,
      },
    };
  },
});
