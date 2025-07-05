import { Logger } from "@/lib/logger";
import { db, eq } from "@weldr/db";
import { versions } from "@weldr/db/schema";
import { planSchema } from "@weldr/shared/validators/plans";
import { z } from "zod";
import { createTasks } from "../utils/tasks";
import { createTool } from "../utils/tools";

export const callCoderTool = createTool({
  name: "call_coder",
  description: "Hands off the project to the coder agent to start development.",
  whenToUse:
    "After all setup is complete and the user has confirmed the plan. This should be the final action.",
  inputSchema: planSchema.describe("The plan to be completed"),
  outputSchema: z.discriminatedUnion("success", [
    planSchema.extend({
      success: z.literal(true),
    }),
  ]),
  execute: async ({ input, context }) => {
    const { commitMessage, description, acceptanceCriteria } = input;
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
        status: "coding",
        message: commitMessage,
        description,
        acceptanceCriteria,
      })
      .where(eq(versions.id, version.id))
      .returning();

    if (!updatedVersion) {
      logger.error("Failed to update version");
      throw new Error(
        `[plannerAgent:call_coder:${project.id}] Failed to update version`,
      );
    }

    await createTasks({
      taskList: input.tasks,
      context,
    });

    context.set("version", updatedVersion);

    const streamWriter = global.sseConnections?.get(updatedVersion.chatId);

    if (!streamWriter) {
      throw new Error("Stream writer not found");
    }

    await streamWriter.write({
      type: "update_project",
      data: {
        currentVersion: {
          message: commitMessage,
          description,
          status: "coding",
        },
      },
    });

    logger.info("Version updated successfully");

    return {
      success: true,
      commitMessage: input.commitMessage,
      description: input.description,
      tasks: input.tasks,
    };
  },
});
