import { Logger } from "@/lib/logger";
import { nanoid } from "@weldr/shared/nanoid";
import { redisClient } from "@weldr/shared/redis";

export interface BackgroundJob<T = unknown> {
  id: string;
  type: string;
  data: T;
  priority: number;
  retries: number;
  maxRetries: number;
  createdAt: Date;
  scheduledAt?: Date;
  lastError?: string;
}

export interface JobResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export class BackgroundJobQueue {
  private readonly queueKey: string;
  private readonly processingKey: string;
  private readonly completedKey: string;
  private readonly failedKey: string;
  private readonly logger: ReturnType<typeof Logger.get>;
  private isProcessing = false;
  private processingInterval?: ReturnType<typeof setInterval>;

  constructor(queueName = "default") {
    this.queueKey = `job:queue:${queueName}`;
    this.processingKey = `job:processing:${queueName}`;
    this.completedKey = `job:completed:${queueName}`;
    this.failedKey = `job:failed:${queueName}`;
    this.logger = Logger.get({ tags: ["BackgroundJobQueue"] });
  }

  /**
   * Add a job to the queue
   */
  async enqueue<T>(
    type: string,
    data: T,
    options: {
      priority?: number;
      maxRetries?: number;
      delay?: number; // delay in milliseconds
    } = {}
  ): Promise<string> {
    const job: BackgroundJob<T> = {
      id: nanoid(),
      type,
      data,
      priority: options.priority ?? 0,
      retries: 0,
      maxRetries: options.maxRetries ?? 3,
      createdAt: new Date(),
      scheduledAt: options.delay ? new Date(Date.now() + options.delay) : undefined,
    };

    // Store job data
    await redisClient.setEx(`job:${job.id}`, 3600 * 24, JSON.stringify(job));

    // Add to priority queue (higher priority = lower score in Redis sorted set)
    const score = options.delay 
      ? Date.now() + options.delay 
      : Date.now() - job.priority * 1000;
    
    await redisClient.zAdd(this.queueKey, { score, value: job.id });

    this.logger.info(`Job enqueued: ${job.id}`, {
      extra: { jobType: type, priority: job.priority, delay: options.delay }
    });

    return job.id;
  }

  /**
   * Start processing jobs
   */
  async startProcessing(processor: (job: BackgroundJob) => Promise<JobResult>) {
    if (this.isProcessing) {
      this.logger.warn("Job processing already started");
      return;
    }

    this.isProcessing = true;
    this.logger.info("Starting job processing");

    this.processingInterval = setInterval(async () => {
      try {
        await this.processNextJob(processor);
      } catch (error) {
        this.logger.error("Error in job processing loop", { 
          extra: { error: error instanceof Error ? error.message : error }
        });
      }
    }, 1000); // Check for jobs every second
  }

  /**
   * Stop processing jobs
   */
  async stopProcessing() {
    if (!this.isProcessing) return;

    this.isProcessing = false;
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }
    this.logger.info("Stopped job processing");
  }

  /**
   * Process the next job in the queue
   */
  private async processNextJob(processor: (job: BackgroundJob) => Promise<JobResult>) {
    // Get jobs that are ready to be processed (score <= current time)
    const jobIds = await redisClient.zRangeByScore(
      this.queueKey,
      0,
      Date.now(),
      { LIMIT: { offset: 0, count: 1 } }
    );

    if (jobIds.length === 0) return;

    const jobId = jobIds[0];
    
    // Move job to processing set
    const removed = await redisClient.zRem(this.queueKey, jobId);
    if (removed === 0) {
      // Job was already processed by another worker
      return;
    }

    await redisClient.sAdd(this.processingKey, jobId);

    try {
      // Get job data
      const jobData = await redisClient.get(`job:${jobId}`);
      if (!jobData) {
        this.logger.error(`Job data not found: ${jobId}`);
        await this.cleanupJob(jobId);
        return;
      }

      const job: BackgroundJob = JSON.parse(jobData);
      this.logger.info(`Processing job: ${jobId}`, { extra: { jobType: job.type } });

      // Process the job
      const result = await processor(job);

      if (result.success) {
        await this.completeJob(job, result);
      } else {
        await this.retryOrFailJob(job, result.error || "Unknown error");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Error processing job ${jobId}`, { extra: { error: errorMessage } });
      
      const jobData = await redisClient.get(`job:${jobId}`);
      if (jobData) {
        const job: BackgroundJob = JSON.parse(jobData);
        await this.retryOrFailJob(job, errorMessage);
      }
    } finally {
      await redisClient.sRem(this.processingKey, jobId);
    }
  }

  /**
   * Complete a job successfully
   */
  private async completeJob(job: BackgroundJob, result: JobResult) {
    await redisClient.zAdd(this.completedKey, { score: Date.now(), value: job.id });
    await redisClient.setEx(`job:result:${job.id}`, 3600 * 24, JSON.stringify(result));
    await redisClient.del(`job:${job.id}`);
    
    this.logger.info(`Job completed: ${job.id}`, { extra: { jobType: job.type } });
  }

  /**
   * Retry a job or mark it as failed
   */
  private async retryOrFailJob(job: BackgroundJob, error: string) {
    job.retries += 1;
    job.lastError = error;

    if (job.retries >= job.maxRetries) {
      // Mark as failed
      await redisClient.zAdd(this.failedKey, { score: Date.now(), value: job.id });
      await redisClient.setEx(`job:error:${job.id}`, 3600 * 24, error);
      await redisClient.del(`job:${job.id}`);
      
      this.logger.error(`Job failed permanently: ${job.id}`, { 
        extra: { jobType: job.type, retries: job.retries, error } 
      });
    } else {
      // Retry with exponential backoff
      const delay = 2 ** job.retries * 1000; // 2s, 4s, 8s...
      const retryTime = Date.now() + delay;
      
      await redisClient.setEx(`job:${job.id}`, 3600 * 24, JSON.stringify(job));
      await redisClient.zAdd(this.queueKey, { score: retryTime, value: job.id });
      
      this.logger.warn(`Job retry scheduled: ${job.id}`, { 
        extra: { jobType: job.type, retries: job.retries, delayMs: delay, error } 
      });
    }
  }

  /**
   * Clean up orphaned job
   */
  private async cleanupJob(jobId: string) {
    await redisClient.sRem(this.processingKey, jobId);
    await redisClient.del(`job:${jobId}`);
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<{
    status: "queued" | "processing" | "completed" | "failed" | "not_found";
    job?: BackgroundJob;
    result?: JobResult;
    error?: string;
  }> {
    // Check if job is in processing
    const isProcessing = await redisClient.sIsMember(this.processingKey, jobId);
    if (isProcessing) {
      const jobData = await redisClient.get(`job:${jobId}`);
      return {
        status: "processing",
        job: jobData ? JSON.parse(jobData) : undefined,
      };
    }

    // Check if job is completed
    const completedScore = await redisClient.zScore(this.completedKey, jobId);
    if (completedScore !== null) {
      const resultData = await redisClient.get(`job:result:${jobId}`);
      return {
        status: "completed",
        result: resultData ? JSON.parse(resultData) : undefined,
      };
    }

    // Check if job is failed
    const failedScore = await redisClient.zScore(this.failedKey, jobId);
    if (failedScore !== null) {
      const error = await redisClient.get(`job:error:${jobId}`);
      return {
        status: "failed",
        error: error || "Unknown error",
      };
    }

    // Check if job is queued
    const queuedScore = await redisClient.zScore(this.queueKey, jobId);
    if (queuedScore !== null) {
      const jobData = await redisClient.get(`job:${jobId}`);
      return {
        status: "queued",
        job: jobData ? JSON.parse(jobData) : undefined,
      };
    }

    return { status: "not_found" };
  }

  /**
   * Get queue statistics
   */
  async getStats() {
    const [queued, processing, completed, failed] = await Promise.all([
      redisClient.zCard(this.queueKey),
      redisClient.sCard(this.processingKey),
      redisClient.zCard(this.completedKey),
      redisClient.zCard(this.failedKey),
    ]);

    return { queued, processing, completed, failed };
  }
}