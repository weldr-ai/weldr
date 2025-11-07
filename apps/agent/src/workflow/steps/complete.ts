import { db, eq } from "@weldr/db";
import { versions } from "@weldr/db/schema";
import { Logger } from "@weldr/shared/logger";

import { syncBranchToS3 } from "@/lib/branch-state";
import { build } from "@/lib/build";
import { isLocalMode } from "@/lib/constants";
import { stream } from "@/lib/stream-utils";
import { createSnapshot } from "@/lib/tigris";
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
      // In local mode, skip build and just mark as completed
      // Dev servers are managed by the web app on-demand
      if (isLocalMode()) {
        logger.info("Local mode: skipping build");

        // Mark version as completed
        await db
          .update(versions)
          .set({
            status: "completed",
          })
          .where(eq(versions.id, branch.headVersion.id));

        logger.info("Version marked as completed");

        const updatedVersion = {
          ...branch.headVersion,
          status: "completed" as const,
        };

        context.set("branch", { ...branch, headVersion: updatedVersion });

        await stream(branch.headVersion.chatId, {
          type: "update_branch",
          data: {
            ...branch,
            headVersion: updatedVersion,
          },
        });

        logger.info("Complete step completed successfully (local mode)");
        return;
      }

      // Cloud mode: create snapshot, build, and upload to Tigris
      const bucketName = `project-${project.id}-branch-${branch.id}`;
      const snapshotName = branch.headVersion.id;

      logger.info("Creating Tigris snapshot", {
        extra: { bucketName, snapshotName },
      });

      // Use project-specific credentials from environment variables
      // These are provided per project and do not require master admin keys
      const credentials = {
        accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
      };

      if (!credentials.accessKeyId || !credentials.secretAccessKey) {
        throw new Error(
          "S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY are required for snapshot creation",
        );
      }

      const snapshotVersion = await createSnapshot(
        bucketName,
        snapshotName,
        credentials,
      );

      logger.info("Tigris snapshot created", {
        extra: { snapshotVersion },
      });

      // Sync branch directory to S3 as backup
      logger.info("Syncing branch directory to S3", {
        extra: { branchId: branch.id, projectId: project.id },
      });

      try {
        const syncResult = await syncBranchToS3(branch.id, project.id);
        if (syncResult.success) {
          logger.info("Branch directory synced to S3 successfully", {
            extra: { bucketName: syncResult.bucketName },
          });
        } else {
          logger.warn(
            "Failed to sync branch directory to S3 (non-critical, continuing)",
            {
              extra: { branchId: branch.id, projectId: project.id },
            },
          );
        }
      } catch (syncError) {
        logger.warn(
          "Error syncing branch directory to S3 (non-critical, continuing)",
          {
            extra: {
              branchId: branch.id,
              projectId: project.id,
              error:
                syncError instanceof Error
                  ? syncError.message
                  : String(syncError),
            },
          },
        );
      }

      // Build the version artifact
      logger.info("Building version artifact", {
        extra: { versionId: branch.headVersion.id },
      });

      const buildResult = await build({
        projectId: project.id,
        branchId: branch.id,
        versionId: branch.headVersion.id,
      });

      if (buildResult.success) {
        logger.info("Version artifact built successfully", {
          extra: { versionId: branch.headVersion.id },
        });
      } else {
        logger.error("Failed to build version artifact", {
          extra: { versionId: branch.headVersion.id },
        });
      }

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
