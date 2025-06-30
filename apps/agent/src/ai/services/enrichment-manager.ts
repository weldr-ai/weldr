import { Logger } from "@/lib/logger";
import type { WorkflowContext } from "@/workflow/context";
import type { DeclarationData } from "@weldr/shared/types/declarations";
import { type BackgroundJob, BackgroundJobQueue, type JobResult } from "./background-jobs";
import { type SemanticData, SemanticEnricher, type SemanticEnrichmentJobData } from "./semantic-enricher";

export class DeclarationEnrichmentManager {
  private readonly jobQueue: BackgroundJobQueue;
  private readonly semanticEnricher: SemanticEnricher;
  private readonly logger: ReturnType<typeof Logger.get>;
  private isInitialized = false;

  constructor() {
    this.jobQueue = new BackgroundJobQueue("semantic-enrichment");
    this.semanticEnricher = new SemanticEnricher();
    this.logger = Logger.get({ tags: ["DeclarationEnrichmentManager"] });
  }

  /**
   * Initialize the enrichment manager and start processing jobs
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.logger.warn("Enrichment manager already initialized");
      return;
    }

    this.logger.info("Initializing declaration enrichment manager");

    // Start processing semantic enrichment jobs
    await this.jobQueue.startProcessing(async (job: BackgroundJob) => {
      return this.processJob(job);
    });

    this.isInitialized = true;
    this.logger.info("Declaration enrichment manager initialized successfully");
  }

  /**
   * Shutdown the enrichment manager
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) return;

    this.logger.info("Shutting down declaration enrichment manager");
    await this.jobQueue.stopProcessing();
    this.isInitialized = false;
    this.logger.info("Declaration enrichment manager shut down");
  }

  /**
   * Queue semantic enrichment for multiple declarations
   */
  async queueSemanticEnrichment({
    declarations,
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
    const project = context.get("project");
    const version = context.get("version");

    const jobIds: string[] = [];

    for (const declaration of declarations) {
      // Check if already enriched to avoid duplicate work
      const isAlreadyEnriched = await this.semanticEnricher.isEnriched(declaration.id);
      if (isAlreadyEnriched) {
        this.logger.debug(`Skipping enrichment for already enriched declaration: ${declaration.id}`);
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

      const jobId = await this.jobQueue.enqueue("semantic-enrichment", jobData, {
        priority,
        maxRetries: 3,
      });

      jobIds.push(jobId);

      this.logger.info(`Queued semantic enrichment job: ${jobId}`, {
        extra: {
          declarationId: declaration.id,
          declarationType: declaration.data.type,
          declarationName: declaration.data.name,
        },
      });
    }

    this.logger.info(`Queued ${jobIds.length} semantic enrichment jobs for file: ${filePath}`, {
      extra: {
        projectId: project.id,
        versionId: version.id,
        totalDeclarations: declarations.length,
        skippedEnriched: declarations.length - jobIds.length,
      },
    });

    return jobIds;
  }

  /**
   * Process a background job
   */
  private async processJob(job: BackgroundJob): Promise<JobResult> {
    switch (job.type) {
      case "semantic-enrichment":
        return this.semanticEnricher.processEnrichmentJob(
          job as BackgroundJob<SemanticEnrichmentJobData>
        );
      default:
        return {
          success: false,
          error: `Unknown job type: ${job.type}`,
        };
    }
  }

  /**
   * Get enrichment status for a declaration
   */
  async getEnrichmentStatus(declarationId: string): Promise<{
    isEnriched: boolean;
    semanticData?: SemanticData | null;
  }> {
    const isEnriched = await this.semanticEnricher.isEnriched(declarationId);
    let semanticData: SemanticData | null = null;

    if (isEnriched) {
      semanticData = await this.semanticEnricher.getSemanticData(declarationId);
    }

    return {
      isEnriched,
      semanticData,
    };
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string) {
    return this.jobQueue.getJobStatus(jobId);
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    return this.jobQueue.getStats();
  }

  /**
   * Force enrichment of a declaration (even if already enriched)
   */
  async forceEnrichment({
    declarationId,
    declarationData,
    context,
    filePath,
    sourceCode,
    priority = 10, // Higher priority for forced enrichment
  }: {
    declarationId: string;
    declarationData: DeclarationData;
    context: WorkflowContext;
    filePath: string;
    sourceCode: string;
    priority?: number;
  }): Promise<string> {
    const project = context.get("project");
    const version = context.get("version");

    const jobData: SemanticEnrichmentJobData = {
      declarationId,
      declarationData,
      projectId: project.id,
      versionId: version.id,
      filePath,
      sourceCode,
    };

    const jobId = await this.jobQueue.enqueue("semantic-enrichment", jobData, {
      priority,
      maxRetries: 3,
    });

    this.logger.info(`Forced semantic enrichment job: ${jobId}`, {
      extra: {
        declarationId,
        declarationType: declarationData.type,
        declarationName: declarationData.name,
      },
    });

    return jobId;
  }
}

// Global instance
let enrichmentManager: DeclarationEnrichmentManager | null = null;

/**
 * Get the global enrichment manager instance
 */
export function getEnrichmentManager(): DeclarationEnrichmentManager {
  if (!enrichmentManager) {
    enrichmentManager = new DeclarationEnrichmentManager();
  }
  return enrichmentManager;
}

/**
 * Initialize the global enrichment manager
 */
export async function initializeEnrichmentManager(): Promise<void> {
  const manager = getEnrichmentManager();
  await manager.initialize();
}

/**
 * Shutdown the global enrichment manager
 */
export async function shutdownEnrichmentManager(): Promise<void> {
  if (enrichmentManager) {
    await enrichmentManager.shutdown();
    enrichmentManager = null;
  }
}