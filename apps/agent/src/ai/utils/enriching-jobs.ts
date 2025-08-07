import { embedMany, generateObject } from "ai";
import { and, eq, isNotNull } from "drizzle-orm";
import { WORKSPACE_DIR } from "@/lib/constants";

import { db } from "@weldr/db";
import {
  declarations,
  projects,
  versionDeclarations,
  versions,
} from "@weldr/db/schema";
import { mergeJson } from "@weldr/db/utils";
import { Logger } from "@weldr/shared/logger";
import type {
  DeclarationCodeMetadata,
  DeclarationSemanticData,
  DeclarationSpecs,
} from "@weldr/shared/types/declarations";
import { declarationSemanticDataSchema } from "@weldr/shared/validators/declarations/index";
import { runCommand } from "../../lib/commands";
import { registry } from "./registry";

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

export async function recoverSemanticDataJobs(): Promise<void> {
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
        eq(versions.projectId, project.id),
        isNotNull(versions.activatedAt),
      ),
    });

    if (
      !version ||
      version.status === "completed" ||
      version.status === "failed"
    ) {
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

        const sourceCode = await runCommand("cat", [declaration.path], {
          cwd: WORKSPACE_DIR,
        });

        if (sourceCode.exitCode !== 0) {
          logger.error("Failed to read source code", {
            extra: { declarationId: declaration.id },
          });
          continue;
        }

        if (codeMetadata && declaration.path) {
          jobQueue.push({
            declarationId: declaration.id,
            codeMetadata,
            filePath: declaration.path,
            sourceCode: sourceCode.stdout,
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
}

async function enrichDeclaration(jobData: EnrichingJobData): Promise<void> {
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

    const semanticData = await generateDeclarationSemanticData(
      jobData.codeMetadata,
      jobData.filePath,
      jobData.sourceCode,
    );

    if (semanticData) {
      // Generate and store embedding after semantic data is saved
      const embedding = await generateAndStoreEmbedding(jobData.declarationId);

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
          await enrichDeclaration(jobData);
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

async function generateDeclarationSemanticData(
  declaration: DeclarationCodeMetadata,
  filePath: string,
  sourceCode: string,
): Promise<DeclarationSemanticData | null> {
  const logger = Logger.get({
    declarationName: declaration.name,
    declarationType: declaration.type,
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

async function generateAndStoreEmbedding(declarationId: string) {
  try {
    Logger.info("Generating embedding for declaration", {
      extra: { declarationId },
    });

    // Fetch the declaration with its metadata
    const declaration = await db.query.declarations.findFirst({
      where: eq(declarations.id, declarationId),
      columns: {
        id: true,
        metadata: true,
      },
    });

    if (!declaration || !declaration.metadata) {
      Logger.warn("Declaration not found or missing metadata", {
        extra: { declarationId },
      });
      return;
    }

    // Generate searchable text from semantic data and specs
    const embeddingText = generateEmbeddingText(
      declaration.metadata.codeMetadata,
      declaration.metadata.semanticData,
      declaration.metadata.specs,
    );

    if (!embeddingText) {
      Logger.warn("No embedding text generated", {
        extra: { declarationId },
      });
      return;
    }

    // Generate embedding using OpenAI's text-embedding-ada-002
    const embeddingModel = registry.textEmbeddingModel(
      "openai:text-embedding-ada-002",
    );

    const { embeddings } = await embedMany({
      model: embeddingModel,
      values: [embeddingText],
    });

    if (!embeddings || embeddings.length === 0 || !embeddings[0]) {
      Logger.error("Failed to generate embedding", {
        extra: { declarationId },
      });
      return;
    }

    Logger.info("Successfully generated and stored embedding", {
      extra: {
        declarationId,
        embeddingTextLength: embeddingText.length,
      },
    });

    const embedding = embeddings[0];

    if (!embedding) {
      Logger.error("No embedding generated", {
        extra: { declarationId },
      });
      throw new Error("No embedding generated");
    }

    return embedding;
  } catch (error) {
    Logger.error("Failed to generate and store embedding", {
      extra: {
        error: error instanceof Error ? error.message : String(error),
        declarationId,
      },
    });
  }
}

function generateEmbeddingText(
  codeMetadata?: DeclarationCodeMetadata,
  semanticData?: DeclarationSemanticData,
  specs?: DeclarationSpecs["data"],
): string | null {
  if (!codeMetadata && !semanticData && !specs) {
    return null;
  }

  const textParts: string[] = [];

  // Add basic code metadata
  if (codeMetadata) {
    textParts.push(`${codeMetadata.type}: ${codeMetadata.name}`);
  }

  // Add semantic data - focus on the most searchable information
  if (semanticData) {
    // Add summary and description
    textParts.push(semanticData.summary);
    textParts.push(semanticData.description);

    // Add tags for searchability
    if (semanticData.tags.length > 0) {
      textParts.push(`Tags: ${semanticData.tags.join(", ")}`);
    }

    // Add common use cases
    if (semanticData.usagePattern.commonUseCases.length > 0) {
      textParts.push(
        `Use cases: ${semanticData.usagePattern.commonUseCases.join(", ")}`,
      );
    }
  }

  // Add specs based on type
  if (specs) {
    switch (specs.type) {
      case "endpoint": {
        textParts.push(`${specs.method} ${specs.path}`);
        textParts.push(`Endpoint: ${specs.summary}`);
        textParts.push(specs.description);

        // Add request body information
        if (specs.requestBody?.description) {
          textParts.push(`Request: ${specs.requestBody.description}`);
        }

        // Add response information
        if (specs.responses) {
          const responseDescriptions = Object.values(specs.responses).map(
            (response) => response.description,
          );
          textParts.push(`Responses: ${responseDescriptions.join(", ")}`);
        }
        break;
      }
      case "db-model": {
        textParts.push(`Database model: ${specs.name}`);

        // Add column information
        if (specs.columns && specs.columns.length > 0) {
          const columnNames = specs.columns.map(
            (col) => `${col.name} (${col.type})`,
          );
          textParts.push(`Columns: ${columnNames.join(", ")}`);
        }

        // Add relationships
        if (specs.relationships && specs.relationships.length > 0) {
          const relationshipInfo = specs.relationships.map(
            (rel) => `${rel.type} with ${rel.referencedModel}`,
          );
          textParts.push(`Relationships: ${relationshipInfo.join(", ")}`);
        }
        break;
      }
      case "page": {
        textParts.push(`Page: ${specs.name}`);
        textParts.push(`Route: ${specs.route}`);
        textParts.push(specs.description);

        // Add parameter information
        if (specs.parameters && specs.parameters.length > 0) {
          const parameterNames = specs.parameters.map((param) => param.name);
          textParts.push(`Parameters: ${parameterNames.join(", ")}`);
        }
        break;
      }
    }
  }

  return textParts.filter(Boolean).join(" ");
}
