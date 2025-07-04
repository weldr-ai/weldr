import { Logger } from "@/lib/logger";
import { z } from "zod";
import { createTool } from "../utils/tools";

export const promptIntegrationConfigurationTool = createTool({
  name: "prompt_integration_configuration",
  description:
    "Request the configuration for integrations. You can only request the configuration for one integration at a time. Then wait for the user to respond with the configuration.",
  whenToUse:
    "When you need to request the configuration for integrations that are required for a task.",
  inputSchema: z.object({
    keys: z
      .array(z.enum(["postgres"]))
      .describe(
        'The keys of the integrations from the list above (e.g., ["postgres"]).',
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
      tags: ["promptIntegrationConfiguration"],
      extra: {
        projectId: project.id,
        versionId: version.id,
        input,
      },
    });

    logger.info(`Setting up integrations: ${input.keys.join(", ")}`);

    return {
      status: "pending",
    };
  },
});
