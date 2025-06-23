import { runCommand } from "@/ai/utils/commands";
import { WORKSPACE_DIR } from "@/lib/constants";
import { Logger } from "@/lib/logger";
import { z } from "zod";
import { createTool } from "../utils/tools";

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
  example: `<grep>
  <pattern>console.log</pattern>
  <file_pattern>*.ts</file_pattern>
  <ignore_case>true</ignore_case>
  <whole_word>true</whole_word>
  <max_results>50</max_results>
  <context_lines>2</context_lines>
</grep>`,
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
    const version = context.get("version");

    // Create contextual logger with base tags and extras
    const logger = Logger.get({
      tags: ["grepTool"],
      extra: {
        projectId: project.id,
        versionId: version.id,
        input,
      },
    });

    logger.info(`Starting grep search for pattern: ${pattern}`);

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

    args.push(pattern, WORKSPACE_DIR);

    const { stdout, stderr, exitCode } = await runCommand("rg", args, {
      cwd: WORKSPACE_DIR,
    });

    if (exitCode === null || exitCode > 1) {
      logger.error("Failed to execute ripgrep search", {
        extra: {
          exitCode,
          stderr,
        },
      });
      return {
        success: false,
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
              `${WORKSPACE_DIR}/`,
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
        } catch (e) {
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
      success: true,
      results,
      summary: {
        totalMatches,
        filesMatched: filesMatched.size,
        truncated,
      },
    };
  },
});
