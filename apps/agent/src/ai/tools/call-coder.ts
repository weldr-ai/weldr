import { Logger } from "@/lib/logger";
import { db, eq } from "@weldr/db";
import { versions } from "@weldr/db/schema";
import { z } from "zod";
import { createTool } from "../utils/create-tool";

export const callCoderTool = createTool({
  description: "Hands off the project to the coder agent to start development.",
  inputSchema: z.object({
    commitMessage: z
      .string()
      .describe(
        "A short, descriptive commit message for the work to be done (e.g., 'feat: implement user authentication'). Follow the conventional commit message format.",
      ),
    description: z
      .string()
      .describe("A detailed description of the features to be built."),
  }),
  outputSchema: z.discriminatedUnion("success", [
    z.object({
      success: z.literal(true),
      commitMessage: z.string(),
      description: z.string(),
    }),
  ]),
  execute: async ({ input, context }) => {
    const { commitMessage, description } = input;
    const version = context.get("version");
    const project = context.get("project");

    // Create contextual logger with base tags and extras
    const logger = Logger.get({
      tags: ["callCoderTool"],
      extra: {
        projectId: project.id,
        versionId: version.id,
        input,
      },
    });

    logger.info(
      `Calling coder agent with commit message: ${commitMessage} and description: ${description}`,
    );

    const [updatedVersion] = await db
      .update(versions)
      .set({
        progress: "initiated",
        message: commitMessage,
        description,
      })
      .where(eq(versions.id, version.id))
      .returning();

    if (!updatedVersion) {
      logger.error("Failed to update version");
      throw new Error(
        `[plannerAgent:call_coder:${project.id}] Failed to update version`,
      );
    }

    context.set("version", updatedVersion);

    logger.info("Version updated successfully");

    return {
      success: true,
      commitMessage: input.commitMessage,
      description: input.description,
    };
  },
});
