import { db, eq } from "@weldr/db";
import { versions } from "@weldr/db/schema";
import { Logger } from "@weldr/shared/logger";
import type { WorkflowContext } from "./context";

// --- Type Definitions ---
export type Step = {
  id: string;
  execute: ({
    context,
  }: {
    context: WorkflowContext;
  }) => Promise<unknown | "suspend"> | unknown | "suspend";
  timeout?: number; // timeout in milliseconds
};

type RetryConfig = {
  attempts: number;
  delay: number;
};

export type WorkflowConfig = {
  retryConfig: RetryConfig;
};

type StatusStepMapping = {
  [key in "planning" | "coding" | "deploying"]: {
    step: Step;
  };
};

// --- Public API ---
export function createStep({
  id,
  execute,
  timeout,
}: {
  id: string;
  execute: ({
    context,
  }: {
    context: WorkflowContext;
  }) => Promise<unknown> | unknown;
  timeout?: number;
}): Step {
  return { id, execute, timeout };
}

export function createWorkflow(
  config: WorkflowConfig = {
    retryConfig: { attempts: 3, delay: 1000 },
  },
) {
  const { retryConfig } = config;
  const stepMapping: StatusStepMapping = {} as StatusStepMapping;

  const api = {
    onStatus<T extends "pending" | "planning" | "coding" | "deploying">(
      status: T | T[],
      step: Step,
    ) {
      if (Array.isArray(status)) {
        status.forEach((s) => {
          stepMapping[s as keyof StatusStepMapping] = { step };
        });
      } else {
        stepMapping[status as keyof StatusStepMapping] = { step };
      }
      return api;
    },
    async execute({ context }: { context: WorkflowContext }): Promise<void> {
      const project = context.get("project");
      const version = context.get("version");

      const logger = Logger.get({
        projectId: project.id,
        versionId: version.id,
      });

      try {
        logger.info(`Current version status: ${version.status}`);

        // Check if workflow is already completed or failed
        if (version.status === "completed") {
          logger.info("Workflow already completed");
          return;
        }

        if (version.status === "failed") {
          logger.info("Workflow marked as failed");
          return;
        }

        // Find the step to execute based on current status
        const stepConfig =
          stepMapping[version.status as keyof StatusStepMapping];
        if (!stepConfig) {
          logger.warn(`No step configured for status: ${version.status}`);
          return;
        }

        const { step } = stepConfig;

        logger.info(`Executing step: ${step.id} for status: ${version.status}`);

        // Execute the step (with its own retry logic)
        // The step is responsible for updating the version status
        const output = await executeWithRetry({
          step,
          retryConfig,
          context,
        });

        console.log("output", output);

        if (output === "suspend") {
          logger.info(`Step ${step.id} suspended`);
          return;
        }

        logger.info(`Step ${step.id} completed successfully`);

        // Continue to next step by recursively calling execute
        // (the step should have updated the version status)
        await api.execute({ context });
      } catch (error) {
        logger.error("Workflow failed", {
          extra: { error },
        });

        // Mark version as failed
        await db
          .update(versions)
          .set({ status: "failed" })
          .where(eq(versions.id, version.id));

        throw error;
      }
    },
  };

  return api;
}

async function executeWithRetry({
  step,
  retryConfig,
  context,
}: {
  step: Step;
  retryConfig: RetryConfig;
  context: WorkflowContext;
}): Promise<unknown | "suspend"> {
  const project = context.get("project");
  const version = context.get("version");

  const logger = Logger.get({
    stepId: step.id,
    projectId: project.id,
    versionId: version.id,
    timeout: step.timeout,
  });

  let lastError: unknown;

  for (let i = 0; i < retryConfig.attempts; i++) {
    try {
      if (step.timeout && step.timeout > 0) {
        logger.info(
          `Step ${step.id} executing with timeout: ${step.timeout}ms`,
        );
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            reject(
              new Error(`Step ${step.id} timed out after ${step.timeout}ms`),
            );
          }, step.timeout);
        });

        return await Promise.race([
          Promise.resolve(step.execute({ context })),
          timeoutPromise,
        ]);
      }

      return await step.execute({ context });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      logger.error(
        `Step ${step.id} failed on attempt ${i + 1}: ${errorMessage}`,
        {
          extra: {
            error: errorMessage,
            errorStack,
            attempt: i + 1,
            maxAttempts: retryConfig.attempts,
          },
        },
      );

      lastError = error;
      if (i < retryConfig.attempts - 1) {
        const isTimeout =
          error instanceof Error && error.message.includes("timed out");
        logger.info(
          `Step ${step.id} ${isTimeout ? "timed out" : "failed"}. Attempt ${i + 1} of ${retryConfig.attempts}. Retrying in ${retryConfig.delay}ms...`,
          {
            extra: {
              attempt: i + 1,
              maxAttempts: retryConfig.attempts,
              delay: retryConfig.delay,
              isTimeout,
              errorMessage,
            },
          },
        );
        await new Promise((resolve) => setTimeout(resolve, retryConfig.delay));
      }
    }
  }

  logger.error(
    `Step ${step.id} failed after ${retryConfig.attempts} attempts.`,
    {
      extra: { maxAttempts: retryConfig.attempts },
    },
  );
  throw lastError;
}
