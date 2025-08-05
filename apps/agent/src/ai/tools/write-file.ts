import { dirname } from "node:path";
import { z } from "zod";
import { runCommand } from "@/lib/commands";
import { WORKSPACE_DIR } from "@/lib/constants";

import { db } from "@weldr/db";
import { versions } from "@weldr/db/schema";
import { mergeJson } from "@weldr/db/utils";
import { Logger } from "@weldr/shared/logger";
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

    // Always create directories if they don't exist
    const dir = dirname(filePath);
    const mkdirResult = await runCommand("mkdir", ["-p", dir], {
      cwd: WORKSPACE_DIR,
    });
    if (!mkdirResult.success) {
      logger.error("Failed to create directories", {
        extra: {
          exitCode: mkdirResult.exitCode,
          stderr: mkdirResult.stderr,
        },
      });
      return {
        success: false as const,
        error: `Failed to create directories: ${mkdirResult.stderr || mkdirResult.stdout}`,
      };
    }

    // Write content to file using shell redirection
    const writeResult = await runCommand("sh", ["-c", `cat > "${filePath}"`], {
      stdin: content,
      cwd: WORKSPACE_DIR,
    });

    if (!writeResult.success) {
      logger.error("Failed to write file", {
        extra: {
          exitCode: writeResult.exitCode,
          stderr: writeResult.stderr,
        },
      });
      return {
        success: false as const,
        error: `Failed to write file: ${writeResult.stderr || writeResult.stdout}`,
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
