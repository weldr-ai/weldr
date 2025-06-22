import { runCommand } from "@/ai/utils/commands";
import { defineTool } from "@/ai/utils/tools";
import { WORKSPACE_DIR } from "@/lib/constants";
import { Logger } from "@/lib/logger";
import { OpenAI } from "openai";
import { z } from "zod";

const morphClient = new OpenAI({
  apiKey: process.env.MORPH_API_KEY,
  baseURL: "https://api.morphllm.com/v1",
});

export const editFileTool = defineTool({
  name: "edit_file",
  description:
    "Use this tool to propose an edit to an existing file.\n\nThis will be read by a less intelligent model, which will quickly apply the edit. You should make it clear what the edit is, while also minimizing the unchanged code you write.\nWhen writing the edit, you should specify each edit in sequence, with the special comment // ... existing code ... to represent unchanged code in between edited lines.\n\nYou should bias towards repeating as few lines of the original file as possible to convey the change.\nNEVER show unmodified code in the edit, unless sufficient context of unchanged lines around the code you're editing is needed to resolve ambiguity.\nIf you plan on deleting a section, you must provide surrounding context to indicate the deletion.\nDO NOT omit spans of pre-existing code without using the // ... existing code ... comment to indicate its absence.\n\nYou should specify the following arguments before the others: [target_file]",
  whenToUse: "To modify an existing file with specific code changes.",
  example: `<edit_file>
  <target_file>src/components/ui/button.tsx</target_file>
  <code_edit>
// ... existing code ...
import { cva, type VariantProps } from "class-variance-authority";

const buttonVariants = cva(
// ... existing code ...
</code_edit>
</edit_file>`,

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

  execute: async ({ input, context }) => {
    const project = context.get("project");
    const version = context.get("version");

    // Create contextual logger with base tags and extras
    const logger = Logger.get({
      tags: ["editFileTool"],
      extra: {
        projectId: project.id,
        versionId: version.id,
        input,
      },
    });

    logger.info(`Editing file: ${input.targetFile}`);

    // Read the current file content
    const readResult = await runCommand("cat", [input.targetFile], {
      cwd: WORKSPACE_DIR,
    });
    if (!readResult.success) {
      logger.error(`Failed to read file: ${readResult.stderr}`);
      throw new Error(`Failed to read file: ${readResult.stderr}`);
    }
    const originalCode = readResult.stdout;

    // Use Morph's fast apply API to generate the updated code
    const response = await morphClient.chat.completions.create({
      model: "morph-v2",
      messages: [
        {
          role: "user",
          content: `<code>${originalCode}</code>\n<update>${input.codeEdit}</update>`,
        },
      ],
      stream: false, // set to true if you want to stream the response
    });

    const updatedCode = response.choices[0]?.message.content;

    if (!updatedCode) {
      logger.error("Failed to get updated code from the edit operation.");
      throw new Error("Failed to get updated code from the edit operation.");
    }

    // Write the updated content back to the file
    const writeResult = await runCommand("tee", [input.targetFile], {
      stdin: updatedCode,
      cwd: WORKSPACE_DIR,
    });
    if (!writeResult.success) {
      logger.error(`Failed to write file: ${writeResult.stderr}`);
      throw new Error(`Failed to write file: ${writeResult.stderr}`);
    }

    logger.info(`File edited successfully: ${input.targetFile}`);

    return {
      success: true,
      message: `Successfully applied edit to ${input.targetFile}: ${input.codeEdit}`,
      changes_applied: input.codeEdit,
    };
  },
});
