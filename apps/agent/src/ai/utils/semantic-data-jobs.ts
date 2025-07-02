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
import { Queue, Worker } from "bullmq";
import { eq } from "drizzle-orm";
import Redis from "ioredis";
import { registry } from "./registry";

// Redis connection
const redis = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT) || 6379,
  maxRetriesPerRequest: 3,
});

// Job queue
export const semanticDataQueue = new Queue("semantic-data", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: 10,
    removeOnFail: 5,
  },
});

export interface SemanticDataJobData {
  declarationId: string;
  codeMetadata: DeclarationCodeMetadata;
  filePath: string;
  sourceCode: string;
}

// Worker to process semantic data generation jobs
export const semanticDataWorker = new Worker(
  "semantic-data",
  async (job) => {
    const logger = Logger.get({
      tags: ["semanticDataWorker"],
      extra: {
        jobId: job.id,
        attempt: job.attemptsMade + 1,
      },
    });

    const {
      declarationId,
      codeMetadata,
      filePath,
      sourceCode,
    }: SemanticDataJobData = job.data;

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
      throw error; // Re-throw to trigger retry
    }
  },
  {
    connection: redis,
    concurrency: 5, // Process up to 5 jobs concurrently
  },
);

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
    await semanticDataQueue.add("generate-semantic-data", jobData, {
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

// Graceful shutdown
export async function shutdownSemanticJobs(): Promise<void> {
  const logger = Logger.get({ tags: ["shutdownSemanticJobs"] });

  try {
    await semanticDataWorker.close();
    await semanticDataQueue.close();
    await redis.quit();
    logger.info("Successfully shut down semantic data jobs");
  } catch (error) {
    logger.error("Error shutting down semantic data jobs", {
      extra: { error: error instanceof Error ? error.message : String(error) },
    });
  }
}
