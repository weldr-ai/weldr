import { dirname } from "node:path";
import { runCommand } from "@/ai/utils/commands";
import { WORKSPACE_DIR } from "@/lib/constants";
import { Logger } from "@/lib/logger";
import { z } from "zod";
import { createTool } from "../utils/create-tool";

export const writeFileTool = createTool({
  description:
    "Create a new file or overwrite an existing file with the specified content.",
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

    // Create contextual logger with base tags and extras
    const logger = Logger.get({
      tags: ["writeFileTool"],
      extra: {
        projectId: project.id,
        versionId: version.id,
        input: {
          filePath: input.filePath,
          contentLength: input.content.length,
        },
      },
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
        success: false,
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
        success: false,
        error: `Failed to write file: ${writeResult.stderr || writeResult.stdout}`,
      };
    }

    logger.info("File written successfully");

    return {
      success: true,
      filePath,
      message: `Successfully wrote ${content.length} characters to ${filePath}`,
    };
  },
});
