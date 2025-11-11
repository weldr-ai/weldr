import { createBucketSnapshot as tigrisCreateBucketSnapshot } from "@tigrisdata/storage";

import { Logger } from "@weldr/shared/logger";

interface Credentials {
  accessKeyId: string;
  secretAccessKey: string;
}

/**
 * Creates a snapshot of a Tigris bucket using project-specific credentials.
 * This is a minimal implementation for the agent app that does not require
 * master admin keys or IAM operations.
 */
export async function createSnapshot(
  bucketName: string,
  snapshotName: string,
  credentials: Credentials,
): Promise<string> {
  try {
    const response = await tigrisCreateBucketSnapshot(bucketName, {
      name: snapshotName,
      config: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
      },
    });

    if (response.error) {
      Logger.error("Create snapshot error", {
        bucketName,
        snapshotName,
        error: response.error,
      });
      throw response.error;
    }

    Logger.info("Snapshot created", {
      bucketName,
      snapshotName,
      version: response.data.snapshotVersion,
    });

    return response.data.snapshotVersion;
  } catch (error) {
    Logger.error("Create snapshot error", {
      bucketName,
      snapshotName,
      error,
    });
    throw error;
  }
}
