import { promises as fs } from "node:fs";
import * as path from "node:path";
import { and, eq, isNotNull, not } from "drizzle-orm";

import { db } from "@weldr/db";
import {
  declarations,
  projects,
  versionDeclarations,
  versions,
} from "@weldr/db/schema";
import { mergeJson } from "@weldr/db/utils";
import { Logger } from "@weldr/shared/logger";
import type { DeclarationCodeMetadata } from "@weldr/shared/types/declarations";

import { WORKSPACE_DIR } from "@/lib/constants";
import { embedDeclaration } from "./embed-declarations";
import { enrichDeclaration } from "./enrich";

export interface EnrichingJobData {
  declarationId: string;
  codeMetadata: DeclarationCodeMetadata;
  filePath: string;
  sourceCode: string;
  projectId: string;
  retryCount?: number;
}

// Simple queue for semantic data jobs
const jobQueue: EnrichingJobData[] = [];
let isProcessing = false;
const MAX_RETRIES = 3;

export async function queueEnrichingJob(
  jobData: EnrichingJobData,
): Promise<void> {
  const logger = Logger.get({
    declarationId: jobData.declarationId,
    declarationName: jobData.codeMetadata.name,
    projectId: jobData.projectId,
  });

  try {
    // Set declaration status to "enriching" to mark it for processing
    await db
      .update(declarations)
      .set({ progress: "enriching" })
      .where(eq(declarations.id, jobData.declarationId));

    // Add to queue
    jobQueue.push(jobData);

    logger.info("Queued declaration for semantic data generation", {
      extra: {
        declarationId: jobData.declarationId,
        declarationName: jobData.codeMetadata.name,
        queueLength: jobQueue.length,
      },
    });

    // Process queue if not already processing
    if (!isProcessing) {
      processDeclarationsQueue();
    }
  } catch (error) {
    logger.error("Failed to queue semantic data generation job", {
      extra: {
        error: error instanceof Error ? error.message : String(error),
        declarationId: jobData.declarationId,
        projectId: jobData.projectId,
      },
    });
  }
}

export async function recoverEnrichingJobs(): Promise<void> {
  Logger.info("Recovering enriching jobs");
  let project: typeof projects.$inferSelect | undefined;

  if (process.env.NODE_ENV === "development") {
    project = await db.query.projects.findFirst({
      orderBy: (projects, { desc }) => [desc(projects.createdAt)],
    });
  } else if (process.env.NODE_ENV === "production") {
    project = await db.query.projects.findFirst({
      // biome-ignore lint/style/noNonNullAssertion: reason
      where: eq(projects.id, process.env.PROJECT_ID!),
    });
  }

  if (!project) {
    throw new Error("Project not found");
  }

  const logger = Logger.get({
    projectId: project.id,
  });

  try {
    // Find declarations that are still in "enriching" state
    const version = await db.query.versions.findFirst({
      where: and(
        not(eq(versions.status, "planning")),
        eq(versions.projectId, project.id),
        isNotNull(versions.activatedAt),
      ),
    });

    if (!version) {
      return;
    }

    const declarationsList = await db.query.versionDeclarations.findMany({
      where: eq(versionDeclarations.versionId, version.id),
      with: {
        declaration: {
          columns: {
            id: true,
            path: true,
            metadata: true,
            progress: true,
          },
        },
      },
    });

    const enrichingDeclarations = declarationsList
      .map((declaration) => declaration.declaration)
      .filter((declaration) => declaration.progress === "enriching");

    if (enrichingDeclarations.length > 0) {
      logger.info(
        "Found declarations in enriching state, queueing for processing",
        {
          extra: { count: enrichingDeclarations.length },
        },
      );

      // Add recovered declarations to queue
      for (const declaration of enrichingDeclarations) {
        const codeMetadata = declaration.metadata?.codeMetadata;

        if (!declaration.path) {
          continue;
        }

        let sourceCodeContent: string;
        try {
          const fullPath = path.resolve(WORKSPACE_DIR, declaration.path);

          if (!fullPath.startsWith(WORKSPACE_DIR)) {
            logger.error("Path traversal attempt detected", {
              extra: { declarationId: declaration.id, path: declaration.path },
            });
            continue;
          }

          sourceCodeContent = await fs.readFile(fullPath, "utf-8");
        } catch (error) {
          logger.error("Failed to read source code", {
            extra: {
              declarationId: declaration.id,
              error: error instanceof Error ? error.message : String(error),
            },
          });
          continue;
        }

        if (codeMetadata && declaration.path) {
          jobQueue.push({
            declarationId: declaration.id,
            codeMetadata,
            filePath: declaration.path,
            sourceCode: sourceCodeContent,
            projectId: project.id,
          });
        }
      }

      // Start processing if we have jobs
      if (jobQueue.length > 0) {
        processDeclarationsQueue();
      }
    }
  } catch (error) {
    logger.error("Error recovering semantic data jobs", {
      extra: {
        error: error instanceof Error ? error.message : String(error),
        projectId: project.id,
      },
    });
  }

  Logger.info("Recovered enriching jobs");
}

async function enrichDeclarationJob(jobData: EnrichingJobData): Promise<void> {
  const logger = Logger.get({
    declarationId: jobData.declarationId,
    declarationName: jobData.codeMetadata.name,
  });

  try {
    logger.info("Processing semantic data generation", {
      extra: {
        declarationId: jobData.declarationId,
        declarationName: jobData.codeMetadata.name,
        declarationType: jobData.codeMetadata.type,
        filePath: jobData.filePath,
      },
    });

    const semanticData = await enrichDeclaration(
      jobData.codeMetadata,
      jobData.filePath,
      jobData.sourceCode,
    );

    if (semanticData) {
      const declaration = await db.query.declarations.findFirst({
        where: eq(declarations.id, jobData.declarationId),
      });

      if (!declaration?.metadata) {
        logger.error("Declaration has no metadata", {
          extra: { declarationId: jobData.declarationId },
        });
        return;
      }

      // Generate and store embedding after semantic data is saved
      const embedding = await embedDeclaration(declaration.metadata);

      await db
        .update(declarations)
        .set({
          metadata: mergeJson(declarations.metadata, {
            semanticData,
          }),
          embedding,
          progress: "completed",
        })
        .where(eq(declarations.id, jobData.declarationId));

      logger.info("Successfully generated and saved semantic data", {
        extra: {
          declarationId: jobData.declarationId,
          declarationName: jobData.codeMetadata.name,
        },
      });
    } else {
      handleJobRetry(jobData, "Failed to generate semantic data");
    }
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    handleJobRetry(
      jobData,
      "Failed to process semantic data generation",
      errorObj,
    );
  }
}

async function processDeclarationsQueue(): Promise<void> {
  if (isProcessing) return;

  isProcessing = true;
  while (jobQueue.length > 0) {
    // Take up to 5 jobs from the queue
    const batch = jobQueue.splice(0, 5);

    Logger.info("Processing semantic data batch", {
      extra: { batchSize: batch.length, remainingInQueue: jobQueue.length },
    });

    // Process all jobs in the batch concurrently
    await Promise.allSettled(
      batch.map(async (jobData) => {
        try {
          await enrichDeclarationJob(jobData);
        } catch (error) {
          Logger.error("Failed to process semantic data job", {
            extra: {
              error: error instanceof Error ? error.message : String(error),
              declarationId: jobData.declarationId,
            },
          });
        }
      }),
    );
  }

  isProcessing = false;
  Logger.info("Finished processing semantic data queue");
}

function handleJobRetry(
  jobData: EnrichingJobData,
  reason: string,
  error?: Error,
): boolean {
  const currentRetryCount = jobData.retryCount ?? 0;

  if (currentRetryCount >= MAX_RETRIES) {
    Logger.error(`${reason} after max retries, giving up`, {
      extra: {
        declarationId: jobData.declarationId,
        declarationName: jobData.codeMetadata.name,
        retryCount: currentRetryCount,
        maxRetries: MAX_RETRIES,
        ...(error && { error: error.message }),
      },
    });
    return false;
  }

  Logger.warn(`${reason}, retrying`, {
    extra: {
      declarationId: jobData.declarationId,
      declarationName: jobData.codeMetadata.name,
      retryCount: currentRetryCount + 1,
      maxRetries: MAX_RETRIES,
      ...(error && { error: error.message }),
    },
  });

  // Add back to queue with incremented retry count
  jobQueue.push({
    ...jobData,
    retryCount: currentRetryCount + 1,
  });

  return true;
}
