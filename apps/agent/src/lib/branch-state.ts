import { promises as fs } from "node:fs";
import path from "node:path";

import { Logger } from "@weldr/shared/logger";

import { runCommand } from "./commands";
import { resolveScriptPath, WORKSPACE_BASE } from "./constants";

export interface BranchMetadata {
  branchId: string;
  projectId: string;
  lastAccessedAt: string;
  sizeBytes: number;
  createdAt: string;
}

export interface BranchState {
  branches: Record<string, BranchMetadata>;
}

const BRANCH_STATE_FILE = path.join(WORKSPACE_BASE, "global-state.json");

export async function loadState(): Promise<BranchState> {
  try {
    const content = await fs.readFile(BRANCH_STATE_FILE, "utf-8");
    return JSON.parse(content) as BranchState;
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") {
      return { branches: {} };
    }
    throw error;
  }
}

export async function saveState(state: BranchState): Promise<void> {
  const tmpFile = `${BRANCH_STATE_FILE}.tmp`;
  await fs.writeFile(tmpFile, JSON.stringify(state, null, 2), "utf-8");
  await fs.rename(tmpFile, BRANCH_STATE_FILE);
}

export async function ensureBranchDir(
  branchId: string,
  projectId: string,
): Promise<{
  branchDir: string;
  status: "created" | "reused";
}> {
  const logger = Logger.get();

  logger.info("Ensuring branch directory exists", {
    extra: { branchId, projectId },
  });

  const result = await runCommand(
    resolveScriptPath("create-branch-dir.sh"),
    [branchId, projectId],
    {
      env: {
        ...process.env,
        WORKSPACE_BASE: WORKSPACE_BASE,
        MAX_VOLUME_USAGE_PERCENT: process.env.MAX_VOLUME_USAGE_PERCENT || "85",
        TARGET_VOLUME_USAGE_PERCENT:
          process.env.TARGET_VOLUME_USAGE_PERCENT || "70",
      },
    },
  );

  if (!result.success) {
    logger.error("Failed to ensure branch directory", {
      extra: {
        branchId,
        projectId,
        exitCode: result.exitCode,
        stderr: result.stderr,
        stdout: result.stdout,
      },
    });
    throw new Error(`Failed to ensure branch directory: ${result.stderr}`);
  }

  const output = result.stdout;
  const statusMatch = output.match(/STATUS=(\w+)/);
  const dirMatch = output.match(/BRANCH_DIR=(.+)/);

  const status = statusMatch?.[1] as "created" | "reused" | undefined;
  const branchDir = dirMatch?.[1]?.trim();

  if (!status || !branchDir) {
    logger.error("Failed to parse branch directory output", {
      extra: { branchId, projectId, stdout: output },
    });
    throw new Error("Failed to parse branch directory output");
  }

  logger.info("Branch directory ensured", {
    extra: { branchId, projectId, branchDir, status },
  });

  // If directory was reused, sync from S3 to get latest changes
  if (status === "reused") {
    logger.info("Directory reused, syncing from S3", {
      extra: { branchId, projectId },
    });

    try {
      const syncResult = await syncBranchFromS3(branchId, projectId);

      if (syncResult.success) {
        if (syncResult.skipped) {
          logger.info("Sync from S3 skipped (bucket not found or empty)", {
            extra: { branchId, projectId, reason: syncResult.reason },
          });
        } else {
          logger.info("Successfully synced branch from S3", {
            extra: { branchId, projectId },
          });
        }
      } else {
        logger.warn(
          "Failed to sync from S3 (non-critical, continuing with local files)",
          {
            extra: { branchId, projectId },
          },
        );
      }
    } catch (syncError) {
      logger.warn(
        "Error syncing from S3 (non-critical, continuing with local files)",
        {
          extra: {
            branchId,
            projectId,
            error:
              syncError instanceof Error
                ? syncError.message
                : String(syncError),
          },
        },
      );
    }
  }

  return { branchDir, status };
}

export async function syncBranchToS3(
  branchId: string,
  projectId: string,
): Promise<{ success: boolean; bucketName?: string }> {
  const logger = Logger.get();

  logger.info("Syncing branch to S3", {
    extra: { branchId, projectId },
  });

  // Default S3 endpoint based on NODE_ENV
  const defaultS3Endpoint =
    process.env.NODE_ENV === "production"
      ? "https://fly.storage.tigris.dev"
      : "https://t3.storage.dev";

  const result = await runCommand(
    resolveScriptPath("sync-to-s3.sh"),
    [branchId, projectId],
    {
      env: {
        ...process.env,
        WORKSPACE_BASE: WORKSPACE_BASE,
        S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID || "",
        S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY || "",
        S3_ENDPOINT: process.env.S3_ENDPOINT || defaultS3Endpoint,
        S3_REGION: process.env.S3_REGION || "auto",
      },
    },
  );

  if (!result.success) {
    logger.error("Failed to sync branch to S3", {
      extra: {
        branchId,
        projectId,
        exitCode: result.exitCode,
        stderr: result.stderr,
        stdout: result.stdout,
      },
    });
    return { success: false };
  }

  const bucketMatch = result.stdout.match(/BUCKET_NAME=(.+)/);
  const bucketName = bucketMatch?.[1]?.trim();

  logger.info("Branch synced to S3 successfully", {
    extra: { branchId, projectId, bucketName },
  });

  return { success: true, bucketName };
}

export async function syncBranchFromS3(
  branchId: string,
  projectId: string,
): Promise<{ success: boolean; skipped: boolean; reason?: string }> {
  const logger = Logger.get();

  logger.info("Syncing branch from S3", {
    extra: { branchId, projectId },
  });

  // Default S3 endpoint based on NODE_ENV
  const defaultS3Endpoint =
    process.env.NODE_ENV === "production"
      ? "https://fly.storage.tigris.dev"
      : "https://t3.storage.dev";

  const result = await runCommand(
    resolveScriptPath("sync-from-s3.sh"),
    [branchId, projectId],
    {
      env: {
        ...process.env,
        WORKSPACE_BASE: WORKSPACE_BASE,
        S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID || "",
        S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY || "",
        S3_ENDPOINT: process.env.S3_ENDPOINT || defaultS3Endpoint,
        S3_REGION: process.env.S3_REGION || "auto",
      },
    },
  );

  if (!result.success) {
    logger.error("Failed to sync branch from S3", {
      extra: {
        branchId,
        projectId,
        exitCode: result.exitCode,
        stderr: result.stderr,
        stdout: result.stdout,
      },
    });
    return { success: false, skipped: false };
  }

  const statusMatch = result.stdout.match(/SYNC_STATUS=(\w+)/);
  const status = statusMatch?.[1];

  if (status === "skipped") {
    const reasonMatch = result.stdout.match(/REASON=(\w+)/);
    const reason = reasonMatch?.[1];
    logger.info("Sync from S3 skipped", {
      extra: { branchId, projectId, reason },
    });
    return { success: true, skipped: true, reason };
  }

  logger.info("Branch synced from S3 successfully", {
    extra: { branchId, projectId },
  });

  return { success: true, skipped: false };
}
