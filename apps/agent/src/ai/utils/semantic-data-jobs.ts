import { Logger } from "@/lib/logger";
import { db } from "@weldr/db";
import { declarations } from "@weldr/db/schema";
import { mergeJson } from "@weldr/db/utils";
import type {
  DeclarationCodeMetadata,
  DeclarationSemanticData,
} from "@weldr/shared/types/declarations";
import { declarationSemanticDataSchema } from "@weldr/shared/validators/declarations/index";
import { generateObject } from "ai";
import { eq } from "drizzle-orm";
import { registry } from "./registry";

export interface SemanticDataJobData {
  declarationId: string;
  codeMetadata: DeclarationCodeMetadata;
  filePath: string;
  sourceCode: string;
}

interface QueueJob {
  id: string;
  data: SemanticDataJobData;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  retryDelay: number;
}

class SemanticProcessingQueue {
  private jobs: QueueJob[] = [];
  private processing = false;
  private concurrency = 5;
  private activeJobs = 0;
  private isShuttingDown = false;
  private logger = Logger.get({ tags: ["InMemorySemanticQueue"] });

  async add(
    data: SemanticDataJobData,
    options?: { jobId?: string },
  ): Promise<void> {
    if (this.isShuttingDown) {
      this.logger.warn("Queue is shutting down, rejecting new job");
      return;
    }

    const jobId =
      options?.jobId ||
      `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Check for duplicate jobId
    if (this.jobs.some((job) => job.id === jobId)) {
      this.logger.info("Job with this ID already exists, skipping", {
        extra: { jobId },
      });
      return;
    }

    const job: QueueJob = {
      id: jobId,
      data,
      attempts: 0,
      maxAttempts: 3,
      createdAt: new Date(),
      retryDelay: 2000,
    };

    this.jobs.push(job);
    this.logger.info("Added job to queue", {
      extra: {
        jobId,
        queueSize: this.jobs.length,
        declarationId: data.declarationId,
      },
    });

    // Start processing if not already processing
    if (!this.processing) {
      this.startProcessing();
    }
  }

  private async startProcessing(): Promise<void> {
    if (this.processing || this.isShuttingDown) return;

    this.processing = true;
    this.logger.info("Started queue processing");

    while (this.jobs.length > 0 && !this.isShuttingDown) {
      if (this.activeJobs >= this.concurrency) {
        // Wait a bit before checking again
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }

      const job = this.jobs.shift();
      if (!job) continue;

      this.activeJobs++;
      this.processJob(job).finally(() => {
        this.activeJobs--;
      });
    }

    this.processing = false;
    this.logger.info("Stopped queue processing");
  }

  private async processJob(job: QueueJob): Promise<void> {
    const logger = Logger.get({
      tags: ["processJob"],
      extra: {
        jobId: job.id,
        attempt: job.attempts + 1,
        maxAttempts: job.maxAttempts,
      },
    });

    job.attempts++;

    const { declarationId, codeMetadata, filePath, sourceCode } = job.data;

    logger.info("Processing semantic data generation job", {
      extra: {
        declarationId,
        declarationName: codeMetadata.name,
        declarationType: codeMetadata.type,
      },
    });

    try {
      const semanticData = await generateSemanticData(
        codeMetadata,
        filePath,
        sourceCode,
      );

      if (semanticData) {
        await db
          .update(declarations)
          .set({
            metadata: mergeJson(declarations.metadata, {
              semanticData,
            }),
          })
          .where(eq(declarations.id, declarationId));

        logger.info("Successfully generated and saved semantic data", {
          extra: {
            declarationId,
            declarationName: codeMetadata.name,
          },
        });
      } else {
        logger.warn("Failed to generate semantic data but job completed", {
          extra: {
            declarationId,
            declarationName: codeMetadata.name,
          },
        });
      }
    } catch (error) {
      logger.error("Failed to process semantic data job", {
        extra: {
          error: error instanceof Error ? error.message : String(error),
          declarationId,
          declarationName: codeMetadata.name,
        },
      });

      // Retry logic
      if (job.attempts < job.maxAttempts) {
        logger.info("Retrying job", {
          extra: {
            jobId: job.id,
            attempt: job.attempts,
            retryDelayMs: job.retryDelay,
          },
        });

        // Schedule retry with exponential backoff
        setTimeout(() => {
          this.jobs.push(job);
          if (!this.processing) {
            this.startProcessing();
          }
        }, job.retryDelay);

        job.retryDelay *= 2; // Exponential backoff
      } else {
        logger.error("Job failed after maximum attempts", {
          extra: {
            jobId: job.id,
            declarationId,
            declarationName: codeMetadata.name,
          },
        });
      }
    }
  }

  async shutdown(): Promise<void> {
    this.logger.info("Shutting down queue");
    this.isShuttingDown = true;

    // Wait for active jobs to complete
    while (this.activeJobs > 0) {
      this.logger.info("Waiting for active jobs to complete", {
        extra: { activeJobs: this.activeJobs },
      });
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Clear remaining jobs
    this.jobs = [];
    this.logger.info("Queue shutdown complete");
  }

  getStats() {
    return {
      queueSize: this.jobs.length,
      activeJobs: this.activeJobs,
      processing: this.processing,
      isShuttingDown: this.isShuttingDown,
    };
  }
}

// Create singleton queue instance
export const semanticProcessingQueue = new SemanticProcessingQueue();

async function generateSemanticData(
  declaration: DeclarationCodeMetadata,
  filePath: string,
  sourceCode: string,
): Promise<DeclarationSemanticData | null> {
  const logger = Logger.get({
    tags: ["generateSemanticData"],
    extra: {
      declarationName: declaration.name,
      declarationType: declaration.type,
    },
  });

  try {
    const prompt = `Analyze this ${declaration.type} declaration and generate comprehensive semantic data for it.

Declaration Details:
- Name: ${declaration.name}
- Type: ${declaration.type}
${declaration.typeSignature ? `- Type Signature: ${declaration.typeSignature}` : ""}

Source Code Context:
${filePath}
\`\`\`typescript
${sourceCode}
\`\`\`

Generate semantic data that includes:
1. A concise technical summary (one line)
2. A clear 2-3 sentence description explaining purpose and key features
3. Relevant technical tags (lowercase, hyphenated)
4. Usage patterns including:
   - Common use cases (1-5 specific scenarios)
   - Code examples with descriptions (if applicable)
   - Limitations (if any)
   - Best practices (if applicable)
   - Anti-patterns to avoid (if applicable)

Focus on being practical and helpful for developers who need to understand when and how to use this declaration.`;

    const result = await generateObject({
      model: registry.languageModel("google:gemini-2.5-flash"),
      schema: declarationSemanticDataSchema,
      prompt,
    });

    logger.info("Generated semantic data successfully", {
      extra: {
        declarationName: declaration.name,
        tagsCount: result.object.tags.length,
        useCasesCount: result.object.usagePattern.commonUseCases.length,
      },
    });

    return result.object as DeclarationSemanticData;
  } catch (error) {
    logger.error("Failed to generate semantic data", {
      extra: {
        error: error instanceof Error ? error.message : String(error),
        declarationName: declaration.name,
      },
    });
    return null;
  }
}

// Helper function to queue semantic data generation
export async function queueSemanticDataGeneration(
  jobData: SemanticDataJobData,
): Promise<void> {
  const logger = Logger.get({
    tags: ["queueSemanticDataGeneration"],
    extra: {
      declarationId: jobData.declarationId,
      declarationName: jobData.codeMetadata.name,
    },
  });

  try {
    await semanticProcessingQueue.add(jobData, {
      jobId: `semantic-${jobData.declarationId}`, // Prevent duplicate jobs
    });

    logger.info("Queued semantic data generation job", {
      extra: {
        declarationId: jobData.declarationId,
        declarationName: jobData.codeMetadata.name,
      },
    });
  } catch (error) {
    logger.error("Failed to queue semantic data generation job", {
      extra: {
        error: error instanceof Error ? error.message : String(error),
        declarationId: jobData.declarationId,
      },
    });
  }
}
