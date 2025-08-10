import { z } from "zod";

import { and, db, eq, inArray } from "@weldr/db";
import { declarations, versionDeclarations, versions } from "@weldr/db/schema";
import { mergeJson } from "@weldr/db/utils";
import { Logger } from "@weldr/shared/logger";

import { runCommand } from "@/lib/commands";
import { WORKSPACE_DIR } from "@/lib/constants";
import { createTool } from "./utils";

export const deleteFileTool = createTool({
  name: "delete_file",
  description: "Deletes a file at a specified path.",
  whenToUse: "When you need to delete a file from the project.",
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

    const logger = Logger.get({
      projectId: project.id,
      versionId: version.id,
      input,
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
        success: false as const,
        error: stderr || `Failed to delete file ${filePath}`,
      };
    }

    const declarationsList = await db.query.declarations.findMany({
      where: eq(declarations.path, filePath),
      columns: {
        id: true,
      },
    });

    if (declarationsList.length > 0) {
      await db.delete(versionDeclarations).where(
        and(
          inArray(
            versionDeclarations.declarationId,
            declarationsList.map((d) => d.id),
          ),
          eq(versionDeclarations.versionId, version.id),
        ),
      );
      logger.info(`Deleted ${declarationsList.length} declarations`);
    }

    await db.update(versions).set({
      changedFiles: mergeJson(versions.changedFiles, [
        { path: filePath, type: "deleted" },
      ]),
    });

    logger.info(`File deleted successfully: ${filePath}`);

    // The caller of this tool is responsible for updating the database.
    return {
      success: true as const,
      filePath,
    };
  },
});
