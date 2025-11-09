import { db, eq } from "@weldr/db";
import { branches } from "@weldr/db/schema";
import { Logger } from "@weldr/shared/logger";

import { generateBranchName } from "@/ai/utils/generate-branch-name";
import { getMessages } from "@/ai/utils/get-messages";
import { stream } from "@/lib/stream-utils";
import { createStep } from "../engine";

export const generateBranchNameStep = createStep({
  id: "generate-branch-name",
  execute: async ({ context }) => {
    const project = context.get("project");
    const branch = context.get("branch");

    const logger = Logger.get({
      projectId: project.id,
      versionId: branch.headVersion.id,
    });

    // Only run if branch name is missing
    if (branch.name) {
      logger.info("Branch already has a name, skipping generation");
      return;
    }

    logger.info("Branch missing name, generating...");

    try {
      // Get all messages from the chat to use as input
      const messages = await getMessages(branch.headVersion.chatId);

      if (messages.length === 0) {
        logger.warn("No messages found, cannot generate branch name");
        return;
      }

      const branchName = await generateBranchName(messages);

      // Update the branch in the database
      const [updatedBranch] = await db
        .update(branches)
        .set({
          name: branchName,
        })
        .where(eq(branches.id, branch.id))
        .returning();

      if (!updatedBranch) {
        logger.error("Failed to update branch with generated name");
        return;
      }

      // Update the context with the new data
      context.set("branch", {
        ...branch,
        name: updatedBranch.name,
      });

      // Stream the update to the UI
      await stream(branch.headVersion.chatId, {
        type: "update_branch",
        data: {
          ...branch,
          name: updatedBranch.name,
        } as typeof branch & { name: string },
      });

      logger.info("Generated and updated branch name", {
        branchName,
      });
    } catch (error) {
      logger.error("Failed to generate branch name", {
        extra: { error },
      });
      // Don't throw - allow workflow to continue even if name generation fails
    }
  },
});
