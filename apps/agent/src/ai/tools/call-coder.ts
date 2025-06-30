import { Logger } from "@/lib/logger";
import { db, eq } from "@weldr/db";
import { versions } from "@weldr/db/schema";
import { taskSchema } from "@weldr/shared/validators/tasks";
import { z } from "zod";
import { createDeclarations } from "../utils/create-declarations";
import { createTool } from "../utils/tools";

export const callCoderTool = createTool({
  name: "call_coder",
  description: "Hands off the project to the coder agent to start development.",
  whenToUse:
    "After all setup is complete and the user has confirmed the plan. This should be the final action.",
  inputSchema: taskSchema.describe("The task to be completed"),
  outputSchema: z.discriminatedUnion("success", [
    taskSchema.extend({
      success: z.literal(true),
    }),
  ]),
  execute: async ({ input, context }) => {
    const { commitMessage, description, acceptanceCriteria, declarations } =
      input;
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
        status: "in_progress",
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

    // Create declarations
    await createDeclarations({
      context,
      inputDeclarations: declarations,
    });

    context.set("version", updatedVersion);

    const streamWriter = global.sseConnections?.get(
      context.get("version").chatId,
    );

    if (streamWriter) {
      await streamWriter.write({
        type: "update_project",
        data: {
          currentVersion: {
            message: updatedVersion.message as string,
            description: updatedVersion.description as string,
            status: updatedVersion.status,
          },
        },
      });
    }

    logger.info("Version updated successfully");

    return {
      success: true,
      commitMessage: input.commitMessage,
      description: input.description,
      declarations: input.declarations,
    };
  },
});
