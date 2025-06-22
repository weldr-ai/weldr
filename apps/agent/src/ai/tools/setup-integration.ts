import { Logger } from "@/lib/logger";
import { z } from "zod";
import { createTool } from "../utils/create-tool";

export const setupIntegrationTool = createTool({
  description: "Sets up an integration like a database.",
  inputSchema: z.object({
    key: z
      .enum(["postgres"])
      .describe(
        'The key of the integration from the list above (e.g., "postgres").',
      ),
  }),
  outputSchema: z.discriminatedUnion("success", [
    z.object({
      success: z.literal(true),
      key: z.string(),
    }),
  ]),
  execute: async ({ input, context }) => {
    const project = context.get("project");
    const version = context.get("version");

    // Create contextual logger with base tags and extras
    const logger = Logger.get({
      tags: ["setupIntegration"],
      extra: {
        projectId: project.id,
        versionId: version.id,
        input,
      },
    });

    logger.info(`Setting up integration: ${input.key}`);

    return {
      success: true,
      key: input.key,
    };
  },
});
