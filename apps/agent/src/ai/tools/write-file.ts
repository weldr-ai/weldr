import { promises as fs } from "node:fs";
import * as path from "node:path";
import { z } from "zod";

import { db } from "@weldr/db";
import { versions } from "@weldr/db/schema";
import { mergeJson } from "@weldr/db/utils";
import { Logger } from "@weldr/shared/logger";

import { WORKSPACE_DIR } from "@/lib/constants";
import { extractAndSaveDeclarations } from "../utils/declarations";
import { createTool } from "./utils";

export const writeFileTool = createTool({
  name: "write_file",
  description:
    "Create a new file or overwrite an existing file with the specified content.",
  whenToUse:
    "When you need to create a new file or completely replace the content of an existing file.",
  inputSchema: z.object({
    filePath: z
      .string()
      .describe(
        "The path where the file should be created or overwritten (e.g., 'src/components/Button.tsx')",
      ),
    content: z.string().describe("The content to write to the file"),
  }),
  outputSchema: z.discriminatedUnion("success", [
    z.object({
      success: z.literal(true),
      filePath: z.string(),
      message: z.string(),
    }),
    z.object({
      success: z.literal(false),
      error: z.string(),
    }),
  ]),
  execute: async ({ input, context }) => {
    const { filePath, content } = input;
    const project = context.get("project");
    const version = context.get("version");

    const logger = Logger.get({
      projectId: project.id,
      versionId: version.id,
      input,
    });

    logger.info(`Writing file: ${filePath}`);

    const fullPath = path.resolve(WORKSPACE_DIR, filePath);

    if (!fullPath.startsWith(WORKSPACE_DIR)) {
      logger.error("Path traversal attempt detected", {
        extra: {
          filePath,
          fullPath,
        },
      });
      return {
        success: false as const,
        error: "Invalid file path: path traversal detected",
      };
    }

    const dir = path.dirname(fullPath);

    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      logger.error("Failed to create directories", {
        extra: {
          error: error instanceof Error ? error.message : String(error),
          code:
            error instanceof Error && "code" in error ? error.code : undefined,
        },
      });
      return {
        success: false as const,
        error: `Failed to create directories: ${error instanceof Error ? error.message : String(error)}`,
      };
    }

    try {
      await fs.writeFile(fullPath, content, "utf-8");
    } catch (error) {
      logger.error("Failed to write file", {
        extra: {
          error: error instanceof Error ? error.message : String(error),
          code:
            error instanceof Error && "code" in error ? error.code : undefined,
        },
      });
      return {
        success: false as const,
        error: `Failed to write file: ${error instanceof Error ? error.message : String(error)}`,
      };
    }

    logger.info("File written successfully, extracting declarations...");

    await extractAndSaveDeclarations({
      context,
      filePath,
      sourceCode: content,
    });

    await db.update(versions).set({
      changedFiles: mergeJson(versions.changedFiles, [
        { path: filePath, type: "added" },
      ]),
    });

    return {
      success: true as const,
      filePath,
      message: `Successfully wrote ${content.length} characters to ${filePath}`,
    };
  },
});
