import { Logger } from "@/lib/logger";
import type { WorkflowContext } from "@/workflow/context";
import { db, eq } from "@weldr/db";
import { declarations } from "@weldr/db/schema";
import type { DeclarationData } from "@weldr/shared/types/declarations";
import { generateObject } from "ai";
import { type Job, Queue, Worker } from "bullmq";
import { z } from "zod";
import { registry } from "../utils/registry";

// Schema for semantic enrichment data
const semanticDataSchema = z.object({
  summary: z.string().describe("A concise summary of what this declaration does"),
  purpose: z.string().describe("The main purpose or role of this declaration in the codebase"),
  complexity: z.enum(["low", "medium", "high"]).describe("Complexity level of this declaration"),
  category: z.string().describe("Category or domain this declaration belongs to (e.g., 'authentication', 'ui', 'data')"),
  tags: z.array(z.string()).describe("Relevant tags for categorization and search"),
  relationships: z.array(z.object({
    type: z.enum(["uses", "extends", "implements", "calls", "returns"]),
    target: z.string().describe("What this declaration relates to"),
    description: z.string().describe("Description of the relationship")
  })).describe("Semantic relationships with other code elements"),
  businessValue: z.string().describe("Business or functional value this declaration provides"),
  technicalNotes: z.array(z.string()).describe("Important technical considerations or notes"),
  suggestedImprovements: z.array(z.string()).describe("Potential improvements or refactoring suggestions"),
});

export type SemanticData = z.infer<typeof semanticDataSchema>;

export interface SemanticEnrichmentJobData {
  declarationId: string;
  declarationData: DeclarationData;
  projectId: string;
  versionId: string;
  filePath: string;
  sourceCode: string;
}

// Redis connection config
const redisConfig = {
  host: process.env.REDIS_HOST || "localhost",
  port: Number.parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD,
};

// Create queue and worker instances
let semanticQueue: Queue<SemanticEnrichmentJobData> | null = null;
let semanticWorker: Worker<SemanticEnrichmentJobData> | null = null;

const logger = Logger.get({ tags: ["semantic-enrichment"] });

/**
 * Initialize the semantic enrichment queue and worker
 */
export async function initializeSemanticEnrichment(): Promise<void> {
  if (semanticQueue && semanticWorker) {
    logger.warn("Semantic enrichment already initialized");
    return;
  }

  logger.info("Initializing semantic enrichment queue and worker");

  // Create queue
  semanticQueue = new Queue<SemanticEnrichmentJobData>("semantic-enrichment", {
    connection: redisConfig,
    defaultJobOptions: {
      removeOnComplete: 50, // Keep last 50 completed jobs
      removeOnFail: 20, // Keep last 20 failed jobs
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
    },
  });

  // Create worker
  semanticWorker = new Worker<SemanticEnrichmentJobData>(
    "semantic-enrichment",
    processSemanticEnrichmentJob,
    {
      connection: redisConfig,
      concurrency: 2, // Process 2 jobs concurrently
    }
  );

  // Set up event listeners
  semanticWorker.on("completed", (job) => {
    logger.info(`Semantic enrichment job completed: ${job.id}`, {
      extra: { declarationId: job.data.declarationId }
    });
  });

  semanticWorker.on("failed", (job, err) => {
    logger.error(`Semantic enrichment job failed: ${job?.id}`, {
      extra: { 
        declarationId: job?.data.declarationId,
        error: err.message 
      }
    });
  });

  logger.info("Semantic enrichment initialized successfully");
}

/**
 * Shutdown the semantic enrichment system
 */
export async function shutdownSemanticEnrichment(): Promise<void> {
  logger.info("Shutting down semantic enrichment");

  if (semanticWorker) {
    await semanticWorker.close();
    semanticWorker = null;
  }

  if (semanticQueue) {
    await semanticQueue.close();
    semanticQueue = null;
  }

  logger.info("Semantic enrichment shut down");
}

/**
 * Queue semantic enrichment for declarations
 */
export async function queueSemanticEnrichment({
  declarations: declarationsToEnrich,
  context,
  filePath,
  sourceCode,
  priority = 0,
}: {
  declarations: Array<{ id: string; data: DeclarationData }>;
  context: WorkflowContext;
  filePath: string;
  sourceCode: string;
  priority?: number;
}): Promise<string[]> {
  if (!semanticQueue) {
    throw new Error("Semantic enrichment not initialized");
  }

  const project = context.get("project");
  const version = context.get("version");
  const jobIds: string[] = [];

  for (const declaration of declarationsToEnrich) {
    // Check if already enriched to avoid duplicate work
    const isAlreadyEnriched = await isDeclarationEnriched(declaration.id);
    if (isAlreadyEnriched) {
      logger.debug(`Skipping enrichment for already enriched declaration: ${declaration.id}`);
      continue;
    }

    const jobData: SemanticEnrichmentJobData = {
      declarationId: declaration.id,
      declarationData: declaration.data,
      projectId: project.id,
      versionId: version.id,
      filePath,
      sourceCode,
    };

    const job = await semanticQueue.add("enrich-declaration", jobData, {
      priority,
    });

    if (job.id) {
      jobIds.push(job.id);
    }

    logger.info(`Queued semantic enrichment job: ${job.id}`, {
      extra: {
        declarationId: declaration.id,
        declarationType: declaration.data.type,
        declarationName: declaration.data.name,
      },
    });
  }

  logger.info(`Queued ${jobIds.length} semantic enrichment jobs for file: ${filePath}`, {
    extra: {
      projectId: project.id,
      versionId: version.id,
      totalDeclarations: declarationsToEnrich.length,
      skippedEnriched: declarationsToEnrich.length - jobIds.length,
    },
  });

  return jobIds;
}

/**
 * Process a semantic enrichment job
 */
async function processSemanticEnrichmentJob(
  job: Job<SemanticEnrichmentJobData>
): Promise<SemanticData> {
  const { declarationId, declarationData, projectId, filePath, sourceCode } = job.data;

  logger.info(`Processing semantic enrichment for declaration: ${declarationId}`, {
    extra: { 
      declarationType: declarationData.type,
      declarationName: declarationData.name,
      filePath 
    }
  });

  // Generate semantic data using a cheap model (GPT-4o-mini)
  const semanticData = await generateSemanticData({
    declarationData,
    filePath,
    sourceCode,
    projectId,
  });

  // Update the declaration with semantic data
  await saveSemanticData(declarationId, semanticData);

  logger.info(`Successfully enriched declaration: ${declarationId}`, {
    extra: { 
      complexity: semanticData.complexity,
      category: semanticData.category,
      tagsCount: semanticData.tags.length
    }
  });

  return semanticData;
}

/**
 * Generate semantic data using AI
 */
async function generateSemanticData({
  declarationData,
  filePath,
  sourceCode,
  projectId,
}: {
  declarationData: DeclarationData;
  filePath: string;
  sourceCode: string;
  projectId: string;
}): Promise<SemanticData> {
  // Get relevant context from the source code around the declaration
  const context = extractDeclarationContext(sourceCode, declarationData);

  // Create a prompt for semantic analysis
  const prompt = createSemanticAnalysisPrompt({
    declarationData,
    filePath,
    context,
    projectId,
  });

  // Use a cheap model for semantic analysis (GPT-4o-mini)
  const result = await generateObject({
    model: registry.languageModel("openai:gpt-4o-mini"),
    schema: semanticDataSchema,
    prompt,
    temperature: 0.3, // Lower temperature for more consistent results
  });

  return result.object;
}

/**
 * Extract relevant context around a declaration from source code
 */
function extractDeclarationContext(sourceCode: string, declarationData: DeclarationData): string {
  const lines = sourceCode.split('\n');
  const startLine = Math.max(0, (declarationData.location?.start?.line ?? 1) - 5);
  const endLine = Math.min(lines.length - 1, (declarationData.location?.end?.line ?? lines.length) + 5);
  
  return lines.slice(startLine, endLine + 1).join('\n');
}

/**
 * Create a semantic analysis prompt
 */
function createSemanticAnalysisPrompt({
  declarationData,
  filePath,
  context,
  projectId,
}: {
  declarationData: DeclarationData;
  filePath: string;
  context: string;
  projectId: string;
}): string {
  return `Analyze the following code declaration and provide semantic enrichment data.

**Project Context:**
- Project ID: ${projectId}
- File Path: ${filePath}
- Declaration Type: ${declarationData.type}
- Declaration Name: ${declarationData.name}

**Declaration Details:**
${JSON.stringify(declarationData, null, 2)}

**Code Context:**
\`\`\`typescript
${context}
\`\`\`

**Instructions:**
Analyze this declaration and provide semantic enrichment data including:
1. A clear summary of what this declaration does
2. Its purpose in the codebase
3. Complexity assessment (low/medium/high)
4. Appropriate category/domain classification
5. Relevant tags for search and categorization
6. Semantic relationships with other code elements
7. Business or functional value it provides
8. Technical considerations and notes
9. Potential improvements or refactoring suggestions

Focus on being accurate and helpful for developers who need to understand and work with this code.
Consider the declaration type (${declarationData.type}) and provide analysis appropriate for that type.

For functions: focus on what they do, their inputs/outputs, side effects
For classes: focus on their responsibility, key methods, inheritance
For types/interfaces: focus on their structure, usage patterns, relationships
For constants/variables: focus on their purpose, scope, mutability
For components (React): focus on their UI purpose, props, state, interactions`;
}

/**
 * Save semantic data to the database
 */
async function saveSemanticData(declarationId: string, semanticData: SemanticData): Promise<void> {
  await db
    .update(declarations)
    .set({
      semanticData: semanticData as unknown as Record<string, unknown>,
    })
    .where(eq(declarations.id, declarationId));
}

/**
 * Get semantic data for a declaration
 */
export async function getSemanticData(declarationId: string): Promise<SemanticData | null> {
  const declaration = await db.query.declarations.findFirst({
    where: eq(declarations.id, declarationId),
    columns: {
      semanticData: true,
    },
  });

  if (!declaration?.semanticData) {
    return null;
  }

  try {
    return semanticDataSchema.parse(declaration.semanticData);
  } catch {
    // If parsing fails, return null (data might be in old format)
    return null;
  }
}

/**
 * Check if a declaration has been semantically enriched
 */
export async function isDeclarationEnriched(declarationId: string): Promise<boolean> {
  const semanticData = await getSemanticData(declarationId);
  return semanticData !== null;
}

/**
 * Get queue statistics
 */
export async function getEnrichmentStats() {
  if (!semanticQueue) {
    return { waiting: 0, active: 0, completed: 0, failed: 0 };
  }

  const [waiting, active, completed, failed] = await Promise.all([
    semanticQueue.getWaiting(),
    semanticQueue.getActive(),
    semanticQueue.getCompleted(),
    semanticQueue.getFailed(),
  ]);

  return {
    waiting: waiting.length,
    active: active.length,
    completed: completed.length,
    failed: failed.length,
  };
}

/**
 * Get job status
 */
export async function getJobStatus(jobId: string) {
  if (!semanticQueue) {
    return { status: "not_found" };
  }

  const job = await semanticQueue.getJob(jobId);
  if (!job) {
    return { status: "not_found" };
  }

  return {
    status: await job.getState(),
    job: job.data,
    progress: job.progress,
    returnValue: job.returnvalue,
    failedReason: job.failedReason,
  };
}