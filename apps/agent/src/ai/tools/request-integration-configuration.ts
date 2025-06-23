import { Logger } from "@/lib/logger";
import { z } from "zod";
import { createTool } from "../utils/tools";

export const requestIntegrationConfigurationTool = createTool({
  name: "request_integration_configuration",
  description:
    "Request the configuration for an integration. You can only request the configuration for one integration at a time. Then wait for the user to respond with the configuration.",
  whenToUse: "When you need to request the configuration for an integration.",
  example: `<request_integration_configuration>
  <key>postgres</key>
</request_integration_configuration>`,
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
      tags: ["requestIntegrationConfiguration"],
      extra: {
        projectId: project.id,
        versionId: version.id,
        input,
      },
    });

    logger.info(`Setting up integration: ${input.key}`);

    return {
      status: "pending",
    };
  },
});
