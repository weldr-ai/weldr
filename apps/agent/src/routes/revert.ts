import { createRoute, z } from "@hono/zod-openapi";

import { and, db, eq } from "@weldr/db";
import { branches, projects, versions } from "@weldr/db/schema";
import { Logger } from "@weldr/shared/logger";
import { getBranchDir, isLocalMode } from "@weldr/shared/state";

import { auth } from "@/lib/auth";
import { syncBranchFromS3 } from "@/lib/branch-state";
import { Git } from "@/lib/git";
import { createRouter } from "@/lib/utils";

const route = createRoute({
  method: "post",
  path: "/revert",
  summary: "Revert to a previous version in git",
  description: "Revert to a previous version by creating a revert commit",
  tags: ["Agent"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            projectId: z
              .string()
              .openapi({ description: "Project ID", example: "123abc" }),
            versionId: z.string().openapi({
              description: "Version ID to revert to",
              example: "456def",
            }),
            branchId: z
              .string()
              .openapi({ description: "Branch ID", example: "789ghi" }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Version reverted successfully",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            commitHash: z.string(),
          }),
        },
      },
    },
    400: {
      description: "Bad request",
    },
    401: {
      description: "Unauthorized",
    },
    404: {
      description: "Not found",
    },
  },
});

const router = createRouter();

router.openapi(route, async (c) => {
  const { projectId, versionId, branchId } = c.req.valid("json");

  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const project = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, projectId),
      eq(projects.userId, session.user.id),
    ),
  });

  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  const branch = await db.query.branches.findFirst({
    where: and(eq(branches.id, branchId), eq(branches.projectId, projectId)),
  });

  if (!branch) {
    return c.json({ error: "Branch not found" }, 404);
  }

  const version = await db.query.versions.findFirst({
    where: and(
      eq(versions.id, versionId),
      eq(versions.userId, session.user.id),
    ),
  });

  if (!version) {
    return c.json({ error: "Version not found" }, 404);
  }

  const logger = Logger.get({
    projectId,
    branchId,
    versionId: version.id,
  });

  try {
    const branchDir = getBranchDir(projectId, branchId);

    // Ensure git repository exists
    if (!(await Git.hasGitRepository(branchDir))) {
      return c.json({ error: "Git repository not initialized" }, 400);
    }

    let commitHash: string;

    if (isLocalMode()) {
      // Local mode: use git revert command
      if (!version.commitHash) {
        return c.json({ error: "Version does not have a commit hash" }, 400);
      }

      logger.info("Local mode: performing git revert", {
        extra: { commitHash: version.commitHash },
      });

      commitHash = await Git.revert(
        branch.name,
        version.commitHash,
        `revert: revert to #${version.sequenceNumber} ${version.message}`,
        branchDir,
      );
    } else {
      // Cloud mode: snapshot was already reverted in bucket
      // We need to sync the workspace from S3 to match the reverted bucket state
      // Then commit the reverted state as a new commit

      logger.info(
        "Cloud mode: syncing workspace from S3 after snapshot revert",
        {
          extra: { branchId, projectId },
        },
      );

      const syncResult = await syncBranchFromS3(branchId, projectId);

      if (!syncResult.success) {
        logger.error("Failed to sync branch from S3 after snapshot revert", {
          extra: { branchId, projectId },
        });
        return c.json(
          { error: "Failed to sync workspace from S3 after snapshot revert" },
          500,
        );
      }

      if (syncResult.skipped) {
        logger.warn("S3 sync was skipped", {
          extra: { branchId, projectId, reason: syncResult.reason },
        });
      }

      if (!session.user.name || !session.user.email) {
        logger.error("Session user missing name or email", {
          extra: { userId: session.user.id },
        });
        return c.json({ error: "User information incomplete for commit" }, 500);
      }

      logger.info("Cloud mode: committing reverted state", {
        extra: { branchDir },
      });

      commitHash = await Git.commit(
        `revert: revert to #${version.sequenceNumber} ${version.message}`,
        { name: session.user.name, email: session.user.email },
        branchDir,
      );

      logger.info("Cloud mode: reverted state committed", {
        extra: { commitHash },
      });
    }

    return c.json({ success: true, commitHash });
  } catch (error) {
    logger.error("Revert failed", {
      extra: {
        error: error instanceof Error ? error.message : String(error),
        projectId,
        branchId,
        versionId: version.id,
      },
    });
    return c.json(
      { error: error instanceof Error ? error.message : "Revert failed" },
      500,
    );
  }
});

export default router;
