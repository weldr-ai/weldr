import { z } from "zod";
import { runShell } from "@/ai/utils/commands";
import { WORKSPACE_DIR } from "@/lib/constants";

import { Logger } from "@weldr/shared/logger";
import { createTool } from "../utils/tools";

export const fzfTool = createTool({
  name: "fzf",
  description:
    "Performs a fuzzy search for files or directories in the project.",
  whenToUse:
    "When you need to find files or directories using a fuzzy search on their path.",
  inputSchema: z.object({
    query: z.string().describe("The fuzzy query to search for."),
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
    exactMatch: z
      .boolean()
      .optional()
      .default(false)
      .describe("Whether to perform an exact match."),
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
    const project = context.get("project");
    const version = context.get("version");

    const logger = Logger.get({
      projectId: project.id,
      versionId: version.id,
      input,
    });

    const { query, includeDirectories, includeFiles, maxResults, exactMatch } =
      input;

    logger.info("Starting fuzzy file search");

    // Build find command
    let findCmd = `find "${WORKSPACE_DIR}"`;

    // Add type filter
    if (includeDirectories && !includeFiles) {
      findCmd += " -type d";
      logger.info("Searching directories only");
    } else if (includeFiles && !includeDirectories) {
      findCmd += " -type f";
      logger.info("Searching files only");
    } else {
      logger.info("Searching both files and directories");
    }

    // Exclude common unwanted directories
    findCmd +=
      " \\( -name node_modules -o -name .git -o -name .next -o -name dist -o -name build -o -name .turbo \\) -prune -o -print";

    // Prepare fzf options
    let fzfCmd = `fzf --filter ${JSON.stringify(query)}`;

    if (exactMatch) {
      fzfCmd += " --exact";
      logger.info("Using exact match mode");
    } else {
      logger.info("Using fuzzy match mode");
    }

    // Combine find and fzf with pipe
    const command = `${findCmd} | ${fzfCmd}`;

    logger.info("Executing fuzzy search command", {
      extra: {
        command,
        workingDirectory: WORKSPACE_DIR,
      },
    });

    const { stdout, stderr, exitCode } = await runShell(command, {
      cwd: WORKSPACE_DIR,
    });

    if (exitCode !== 0 && exitCode !== 1) {
      logger.error("Fuzzy search command failed", {
        extra: {
          exitCode,
          stderr,
        },
      });
      return {
        success: false as const,
        error: stderr || "Failed to execute fzf search",
      };
    }

    if (!stdout) {
      logger.info("Fuzzy search completed with no results", {
        extra: {
          exitCode,
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

    logger.info("Fuzzy search completed successfully", {
      extra: {
        totalFound: allResults.length,
        totalReturned: results.length,
        truncated,
        exitCode,
      },
    });

    if (truncated) {
      logger.info(
        `Results truncated: showing ${results.length} of ${allResults.length} matches`,
      );
    }

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
