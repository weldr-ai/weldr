import { z } from "zod";

import { db, eq } from "@weldr/db";
import { versions } from "@weldr/db/schema";
import { Logger } from "@weldr/shared/logger";
import { createTool } from "../utils/tools";

export const callPlannerTool = createTool({
  name: "call_planner",
  description: "Hands off the project to the planner agent to start planning.",
  whenToUse:
    "After completion of gathering requirements and the user has confirmed the plan. This should be the final action.",
  inputSchema: z.object({
    requirements: z.string().describe("Formulated requirements."),
  }),
  outputSchema: z.discriminatedUnion("status", [
    z.object({
      status: z.literal("completed"),
    }),
    z.object({
      status: z.literal("failed"),
      error: z.string(),
    }),
  ]),
  execute: async ({ input, context }) => {
    const version = context.get("version");
    const project = context.get("project");

    // Create contextual logger with base tags and extras
    const logger = Logger.get({
      projectId: project.id,
      versionId: version.id,
      input,
    });

    const [updatedVersion] = await db
      .update(versions)
      .set({
        status: "planning",
      })
      .where(eq(versions.id, version.id))
      .returning();

    if (!updatedVersion) {
      logger.error("Failed to update version");
      return {
        status: "failed" as const,
        error: "Failed to update version",
      };
    }

    context.set("version", updatedVersion);

    const streamWriter = global.sseConnections?.get(updatedVersion.chatId);

    if (!streamWriter) {
      throw new Error("Stream writer not found");
    }

    await streamWriter.write({
      type: "update_project",
      data: {
        currentVersion: {
          status: "planning",
        },
      },
    });

    logger.info("Version updated successfully");

    return {
      status: "completed" as const,
    };
  },
});
