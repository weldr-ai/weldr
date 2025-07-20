import { z } from "zod";
import { runShell } from "@/ai/utils/commands";
import { WORKSPACE_DIR } from "@/lib/constants";

import { Logger } from "@weldr/shared/logger";
import { createTool } from "../utils/tools";

export const findTool = createTool({
  name: "find",
  description: "Finds files based on a search query.",
  whenToUse: "When you need to find files in the project.",
  inputSchema: z.object({
    query: z.string().describe("The substring of the path to search for."),
    includeDirectories: z
      .boolean()
      .optional()
      .default(true)
      .describe("Whether to include directories in the search results."),
    includeFiles: z
      .boolean()
      .optional()
      .default(true)
      .describe("Whether to include files in the search results."),
    maxResults: z
      .number()
      .optional()
      .default(20)
      .describe("The maximum number of results to return."),
  }),
  outputSchema: z.discriminatedUnion("success", [
    z.object({
      success: z.literal(true),
      results: z.array(z.string()),
      summary: z.object({
        totalResults: z.number(),
        truncated: z.boolean(),
      }),
    }),
    z.object({
      success: z.literal(false),
      error: z.string(),
    }),
  ]),
  execute: async ({ input, context }) => {
    const { query, includeDirectories, includeFiles, maxResults } = input;
    const project = context.get("project");
    const version = context.get("version");

    const logger = Logger.get({
      projectId: project.id,
      versionId: version.id,
      input,
    });

    logger.info(`Finding files with query: ${query}`);

    // Build find command
    let findCmd = `find "${WORKSPACE_DIR}"`;

    // Exclude common unwanted directories
    findCmd +=
      " \\( -name node_modules -o -name .git -o -name .next -o -name dist -o -name build -o -name .turbo \\) -prune -o";

    // Add path filter
    findCmd += ` -path "*${query}*"`;

    // Add type filter
    if (includeDirectories && !includeFiles) {
      findCmd += " -type d";
    } else if (includeFiles && !includeDirectories) {
      findCmd += " -type f";
    }

    findCmd += " -print";

    const command = findCmd;
    const { stdout, stderr, exitCode } = await runShell(command, {
      cwd: WORKSPACE_DIR,
    });

    if (exitCode !== 0) {
      logger.error(`Failed to execute find search: ${stderr}`, {
        extra: {
          command,
          exitCode,
          stderr,
        },
      });
      return {
        success: false as const,
        error: stderr || "Failed to execute find search",
      };
    }

    if (!stdout) {
      logger.info("No results found", {
        extra: {
          command,
          exitCode,
          stderr,
        },
      });
      return {
        success: true as const,
        results: [] as string[],
        summary: {
          totalResults: 0,
          truncated: false,
        },
      };
    }

    // Process results
    const allResults = stdout
      .trim()
      .split("\n")
      .filter((line) => line.trim())
      .map((path) => path.replace(`${WORKSPACE_DIR}/`, ""))
      .filter((path) => path && path !== ".");

    const results = allResults.slice(0, maxResults);
    const truncated = allResults.length > maxResults;

    logger.info(`Found ${results.length} results`, {
      extra: {
        command,
        exitCode,
        stderr,
      },
    });

    return {
      success: true as const,
      results,
      summary: {
        totalResults: allResults.length,
        truncated,
      },
    };
  },
});
