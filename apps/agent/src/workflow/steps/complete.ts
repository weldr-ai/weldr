import { db, eq } from "@weldr/db";
import { versions } from "@weldr/db/schema";
import { Logger } from "@weldr/shared/logger";
import { Tigris } from "@weldr/shared/tigris";

import { stream } from "@/lib/stream-utils";
import { createStep } from "../engine";

export const completeStep = createStep({
  id: "complete",
  execute: async ({ context }) => {
    const project = context.get("project");
    const branch = context.get("branch");

    const logger = Logger.get({
      projectId: project.id,
      versionId: branch.headVersion.id,
    });

    logger.info("Starting complete step");

    try {
      const bucketName = `app-${project.id}-branch-${branch.id}`;
      const snapshotName = branch.headVersion.id;

      logger.info("Creating Tigris snapshot", {
        extra: { bucketName, snapshotName },
      });

      const snapshotVersion = await Tigris.bucket.snapshot.create(
        bucketName,
        snapshotName,
      );

      logger.info("Tigris snapshot created", {
        extra: { snapshotVersion },
      });

      await db
        .update(versions)
        .set({
          status: "completed",
          bucketSnapshotVersion: snapshotVersion,
        })
        .where(eq(versions.id, branch.headVersion.id));

      logger.info("Version marked as completed");

      const updatedVersion = {
        ...branch.headVersion,
        status: "completed" as const,
        bucketSnapshotVersion: snapshotVersion,
      };

      context.set("branch", { ...branch, headVersion: updatedVersion });

      await stream(branch.headVersion.chatId, {
        type: "update_branch",
        data: {
          ...branch,
          headVersion: updatedVersion,
        },
      });

      logger.info("Complete step completed successfully");
    } catch (error) {
      logger.error("Complete step failed", {
        extra: { error },
      });
      throw error;
    }
  },
});
