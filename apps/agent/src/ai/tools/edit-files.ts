import { z } from "zod";

import { db } from "@weldr/db";
import { versions } from "@weldr/db/schema";
import { mergeJson } from "@weldr/db/utils";
import { Logger } from "@weldr/shared/logger";

import { runCommand } from "@/lib/commands";
import { WORKSPACE_DIR } from "@/lib/constants";
import { applyEdit } from "../utils/apply-edit";
import { extractAndSaveDeclarations } from "../utils/declarations";
import { createTool } from "./utils";

export const editFileTool = createTool({
  name: "edit_file",
  description:
    "Use this tool to propose an edit to an existing file.\n\nThis will be read by a less intelligent model, which will quickly apply the edit. You should make it clear what the edit is, while also minimizing the unchanged code you write.\nWhen writing the edit, you should specify each edit in sequence, with the special comment // ... existing code ... to represent unchanged code in between edited lines.\n\nYou should bias towards repeating as few lines of the original file as possible to convey the change.\nNEVER show unmodified code in the edit, unless sufficient context of unchanged lines around the code you're editing is needed to resolve ambiguity.\nIf you plan on deleting a section, you must provide surrounding context to indicate the deletion.\nDO NOT omit spans of pre-existing code without using the // ... existing code ... comment to indicate its absence.\n\nYou should specify the following arguments before the others: [target_file]",
  whenToUse:
    "When you need to modify the contents of an existing file by making specific edits.",
  inputSchema: z.object({
    targetFile: z
      .string()
      .describe(
        "The target file to modify. Always specify the target file as the first argument and use the relative path in the workspace of the file to edit",
      ),
    codeEdit: z
      .string()
      .describe(
        "Specify ONLY the precise lines of code that you wish to edit. NEVER specify or write out unchanged code. Instead, represent all unchanged code using the comment of the language you're editing in - example: // ... existing code ...",
      ),
  }),
  outputSchema: z.discriminatedUnion("success", [
    z.object({
      success: z.literal(true),
      message: z.string(),
      changesApplied: z.string(),
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

    logger.info(`Editing file: ${input.targetFile}`);

    // Read the current file content
    const readResult = await runCommand("cat", [input.targetFile], {
      cwd: WORKSPACE_DIR,
    });

    if (!readResult.success) {
      const errorMsg = `Failed to read file: ${readResult.stderr}`;
      logger.error(errorMsg);
      return { success: false as const, error: errorMsg };
    }

    const originalCode = readResult.stdout;

    // Use the apply-edit utility to generate the updated code
    let updatedCode: string;
    try {
      updatedCode = await applyEdit({
        originalCode,
        editInstructions: input.codeEdit,
      });
    } catch (error) {
      const errorMsg = `Failed to apply edit: ${error instanceof Error ? error.message : JSON.stringify(error, null, 2)}`;
      logger.error(errorMsg);
      return { success: false as const, error: errorMsg };
    }

    // Write the updated content back to the file
    const writeResult = await runCommand("tee", [input.targetFile], {
      stdin: updatedCode,
      cwd: WORKSPACE_DIR,
    });

    if (!writeResult.success) {
      const errorMsg = `Failed to write file: ${writeResult.stderr}`;
      logger.error(errorMsg);
      return { success: false as const, error: errorMsg };
    }

    logger.info(
      `File edited successfully: ${input.targetFile}, extracting declarations...`,
    );

    await extractAndSaveDeclarations({
      context,
      filePath: input.targetFile,
      sourceCode: updatedCode,
    });

    await db.update(versions).set({
      changedFiles: mergeJson(versions.changedFiles, [
        {
          path: input.targetFile,
          type: "modified",
        },
      ]),
    });

    return {
      success: true as const,
      message: `Successfully edited ${input.targetFile}`,
      changesApplied: updatedCode,
    };
  },
});
