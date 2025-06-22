import { runCommand } from "@/ai/utils/commands";
import { defineTool } from "@/ai/utils/tools";
import { Logger } from "@/lib/logger";
import { dirname } from "node:path";
import { z } from "zod";

export const writeFileTool = defineTool({
  name: "write_file",
  description:
    "Create a new file or overwrite an existing file with the specified content.",
  whenToUse:
    "When you need to create new files or completely replace the content of existing files.",
  example: `<write_file>
  <file_path>src/components/Header.tsx</file_path>
  <content>import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="bg-blue-600 text-white p-4">
      <h1>My App</h1>
    </header>
  );
};

export default Header;</content>
</write_file>`,

  inputSchema: z.object({
    filePath: z
      .string()
      .describe(
        "The path where the file should be created or overwritten (e.g., 'src/components/Button.tsx')",
      ),
    content: z.string().describe("The content to write to the file"),
  }),

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
    const mkdirResult = await runCommand("mkdir", ["-p", dir]);
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
