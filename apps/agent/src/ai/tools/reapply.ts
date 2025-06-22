import { defineTool } from "@/ai/utils/tools";
import { Logger } from "@/lib/logger";
import { z } from "zod";

export const reapplyTool = defineTool({
  name: "reapply",
  description:
    "Calls a smarter model to apply the last edit to the specified file.",
  whenToUse:
    "Use this tool immediately after the result of an edit_file tool call ONLY IF the diff is not what you expected, indicating the model applying the changes was not smart enough to follow your instructions.",
  example: `<reapply>
  <target_file>src/components/ui/button.tsx</target_file>
</reapply>`,

  inputSchema: z.object({
    targetFile: z
      .string()
      .describe("The relative path to the file to reapply the last edit to."),
  }),

  execute: async ({ input, context }) => {
    const project = context.get("project");
    const version = context.get("version");

    // Create contextual logger with base tags and extras
    const logger = Logger.get({
      tags: ["reapplyTool"],
      extra: {
        projectId: project.id,
        versionId: version.id,
        input,
      },
    });

    logger.info(`Re-applying edit to file: ${input.targetFile}`);

    // This tool is a placeholder and should be implemented by the caller.
    logger.info("Reapply operation completed");

    return {
      success: true,
      message: `Re-applying edit to ${input.targetFile}`,
    };
  },
});
