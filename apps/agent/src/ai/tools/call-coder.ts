import { z } from "zod";

import { db, eq } from "@weldr/db";
import { branches, versions } from "@weldr/db/schema";
import { Logger } from "@weldr/shared/logger";
import { planSchema, taskSchema } from "@weldr/shared/validators/plans";

import { Git } from "@/lib/git";
import { stream } from "@/lib/stream-utils";
import { createTasks } from "../utils/tasks";
import { createTool } from "./utils";

export const callCoderTool = createTool({
  name: "call_coder",
  description: "Hands off the project to the coder agent to start development.",
  whenToUse:
    "After all setup is complete and the user has confirmed the plan. This should be the final action.",
  inputSchema: planSchema.describe("The plan to be completed"),
  outputSchema: z.discriminatedUnion("success", [
    z.object({
      success: z.literal(true),
      commitMessage: z.string(),
      description: z.string(),
      tasks: z.array(taskSchema),
    }),
  ]),
  execute: async ({ input, context }) => {
    const { commitMessage, description, acceptanceCriteria } = input;
    const branch = context.get("branch");
    const project = context.get("project");

    const logger = Logger.get({
      projectId: project.id,
      versionId: branch.headVersion.id,
      input,
    });

    logger.info(
      `Calling coder agent with commit message: ${commitMessage} and description: ${description}`,
    );

    try {
      const branchDetails = await db.query.branches.findFirst({
        where: eq(branches.id, branch.id),
        with: {
          forkedFromVersion: {
            columns: {
              commitHash: true,
            },
          },
        },
      });

      let startCommit: string;
      if (branchDetails?.forkedFromVersion?.commitHash) {
        startCommit = branchDetails.forkedFromVersion.commitHash;
        logger.info("Creating Git branch from fork point", {
          extra: { commit: startCommit },
        });
      } else {
        startCommit = await Git.headCommit();
        logger.info("Creating Git branch from current HEAD", {
          extra: { commit: startCommit },
        });
      }

      await Git.checkoutBranch(branch.name, startCommit);

      logger.info("Created Git branch with meaningful name", {
        extra: { branchName: branch.name, commit: startCommit },
      });
    } catch (error) {
      logger.error("Failed to create Git branch with new name", {
        extra: { error, branchName: branch.name },
      });
    }

    const [updatedVersion] = await db
      .update(versions)
      .set({
        status: "coding",
        message: commitMessage,
        description,
        acceptanceCriteria,
      })
      .where(eq(versions.id, branch.headVersion.id))
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

    await stream(updatedVersion.chatId, {
      type: "update_branch",
      data: {
        ...branch,
        headVersion: updatedVersion,
      },
    });

    logger.info("Version updated successfully");

    return {
      success: true as const,
      commitMessage: input.commitMessage,
      description: input.description,
      tasks: input.tasks,
    };
  },
});
