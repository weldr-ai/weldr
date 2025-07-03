import { WORKSPACE_DIR } from "@/lib/constants";
import { Logger } from "@/lib/logger";
import { db } from "@weldr/db";
import {
  declarations,
  projects,
  versionDeclarations,
  versions,
} from "@weldr/db/schema";
import { mergeJson } from "@weldr/db/utils";
import type {
  DeclarationCodeMetadata,
  DeclarationSemanticData,
} from "@weldr/shared/types/declarations";
import { declarationSemanticDataSchema } from "@weldr/shared/validators/declarations/index";
import { generateObject } from "ai";
import { and, eq, isNotNull } from "drizzle-orm";
import { runCommand } from "./commands";
import { registry } from "./registry";

export interface SemanticDataJobData {
  declarationId: string;
  codeMetadata: DeclarationCodeMetadata;
  filePath: string;
  sourceCode: string;
  projectId: string;
}

// Simple queue for semantic data jobs
const jobQueue: SemanticDataJobData[] = [];
let isProcessing = false;

export async function queueDeclarationSemanticDataGeneration(
  jobData: SemanticDataJobData,
): Promise<void> {
  const logger = Logger.get({
    tags: ["queueDeclarationSemanticDataGeneration"],
    extra: {
      declarationId: jobData.declarationId,
      declarationName: jobData.codeMetadata.name,
      projectId: jobData.projectId,
    },
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
  const project = await db.query.projects.findFirst({
    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    where: eq(projects.id, process.env.PROJECT_ID!),
  });

  if (!project) {
    throw new Error("Project not found");
  }

  const logger = Logger.get({
    tags: ["recoverSemanticDataJobs"],
    extra: { projectId: project.id },
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

async function processDeclaration(jobData: SemanticDataJobData): Promise<void> {
  const logger = Logger.get({
    tags: ["processDeclaration"],
    extra: {
      declarationId: jobData.declarationId,
      declarationName: jobData.codeMetadata.name,
    },
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
      await db
        .update(declarations)
        .set({
          metadata: mergeJson(declarations.metadata, {
            semanticData,
          }),
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
      logger.warn("Failed to generate semantic data, marking as completed", {
        extra: {
          declarationId: jobData.declarationId,
          declarationName: jobData.codeMetadata.name,
        },
      });

      // Mark as completed even if semantic data generation failed
      await db
        .update(declarations)
        .set({ progress: "completed" })
        .where(eq(declarations.id, jobData.declarationId));
    }
  } catch (error) {
    logger.error("Failed to process semantic data generation", {
      extra: {
        error: error instanceof Error ? error.message : String(error),
        declarationId: jobData.declarationId,
      },
    });

    // Mark as completed even if there was an error
    await db
      .update(declarations)
      .set({ progress: "completed" })
      .where(eq(declarations.id, jobData.declarationId));
  }
}

async function processDeclarationsQueue(): Promise<void> {
  if (isProcessing) return;

  isProcessing = true;
  const logger = Logger.get({ tags: ["processDeclarationsQueue"] });

  while (jobQueue.length > 0) {
    // Take up to 5 jobs from the queue
    const batch = jobQueue.splice(0, 5);

    logger.info("Processing semantic data batch", {
      extra: { batchSize: batch.length, remainingInQueue: jobQueue.length },
    });

    // Process all jobs in the batch concurrently
    await Promise.allSettled(
      batch.map(async (jobData) => {
        try {
          await processDeclaration(jobData);
        } catch (error) {
          logger.error("Failed to process semantic data job", {
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
  logger.info("Finished processing semantic data queue");
}

async function generateDeclarationSemanticData(
  declaration: DeclarationCodeMetadata,
  filePath: string,
  sourceCode: string,
): Promise<DeclarationSemanticData | null> {
  const logger = Logger.get({
    tags: ["generateDeclarationSemanticData"],
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
