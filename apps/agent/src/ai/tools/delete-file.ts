import { runCommand } from "@/ai/utils/commands";
import { WORKSPACE_DIR } from "@/lib/constants";
import { Logger } from "@/lib/logger";
import { z } from "zod";
import { createTool } from "../utils/tools";

export const deleteFileTool = createTool({
  name: "delete_file",
  description: "Deletes a file at a specified path.",
  whenToUse: "When you need to delete a file from the project.",
  example: `<delete_file>
  <file_path>src/server/index.ts</file_path>
</delete_file>`,
  inputSchema: z.object({
    filePath: z.string().describe("The path of the file to delete."),
  }),
  outputSchema: z.discriminatedUnion("success", [
    z.object({
      filePath: z.string(),
      success: z.literal(true),
    }),
    z.object({
      success: z.literal(false),
      error: z.string(),
    }),
  ]),
  execute: async ({ input, context }) => {
    const { filePath } = input;
    const project = context.get("project");
    const version = context.get("version");

    // Create contextual logger with base tags and extras
    const logger = Logger.get({
      tags: ["deleteFileTool"],
      extra: {
        projectId: project.id,
        versionId: version.id,
        input,
      },
    });

    logger.info(`Deleting file: ${filePath}`);

    const { exitCode, stderr, success } = await runCommand("rm", [filePath], {
      cwd: WORKSPACE_DIR,
    });

    if (exitCode !== 0 || !success) {
      logger.error("Failed to delete file", {
        extra: {
          exitCode,
          stderr,
        },
      });
      return {
        success: false,
        error: stderr || `Failed to delete file ${filePath}`,
      };
    }

    logger.info(`File deleted successfully: ${filePath}`);

    // The caller of this tool is responsible for updating the database.
    return {
      filePath,
      success: true,
    };
  },
});
