import { defineTool } from "@/ai/utils/tools";
import { Logger } from "@/lib/logger";
import { z } from "zod";

export const setupIntegrationTool = defineTool({
  name: "setup_integration",
  description: "Sets up an integration like a database.",
  whenToUse: "ONLY if the user explicitly requests an integration.",
  example: `<setup_integration>
  <key>postgres</key>
</setup_integration>`,

  inputSchema: z.object({
    key: z
      .enum(["postgres"])
      .describe(
        'The key of the integration from the list above (e.g., "postgres").',
      ),
  }),

  execute: async ({ input, context }) => {
    const project = context.get("project");
    const version = context.get("version");

    // Create contextual logger with base tags and extras
    const logger = Logger.get({
      tags: ["setupIntegrationTool"],
      extra: {
        projectId: project.id,
        versionId: version.id,
        input,
      },
    });

    logger.info(`Setting up integration: ${input.key}`);

    const streamWriter = context.get("streamWriter");
    await streamWriter.write({
      type: "tool",
      toolName: "setup_integration",
      toolArgs: input,
      toolResult: {
        status: "pending",
      },
    });

    logger.info("Integration setup completed");

    return {
      success: true,
      key: input.key,
    };
  },
});
