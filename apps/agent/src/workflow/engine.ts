import { stream } from "@/lib/stream-utils";

import { Logger } from "@weldr/shared/logger";
import type { WorkflowContext } from "./context";

// --- Type Definitions ---
export type Step = {
  id: string;
  execute: ({
    context,
  }: {
    context: WorkflowContext;
  }) => Promise<unknown> | unknown;
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
    status: "idle" as "idle" | "executing" | "suspended",
    suspend() {
      if (api.status === "executing") {
        api.status = "suspended";
        return true;
      }
      return false;
    },
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

      // Check if workflow is already executing
      if (api.status === "executing") {
        logger.warn("Workflow already executing", {
          extra: {
            requestedVersionId: version.id,
          },
        });
        return;
      }

      // Check if workflow is suspended
      if (api.status === "suspended") {
        await stream(version.chatId, {
          type: "end",
        });
        logger.warn("Workflow is suspended - cannot execute", {
          extra: {
            requestedVersionId: version.id,
          },
        });
        return;
      }

      // Mark workflow as executing
      api.status = "executing";

      await stream(version.chatId, {
        type: "responding",
      });

      try {
        logger.info(`Current version status: ${version.status}`);
        logger.info(`Workflow execution started for version ${version.id}`);

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

        await executeWithRetry({
          step,
          retryConfig,
          context,
        });

        await api.execute({ context });
      } catch (error) {
        logger.error("Workflow failed", {
          extra: { error },
        });
        throw error;
      } finally {
        if (api.status === "executing") {
          await stream(version.chatId, {
            type: "end",
          });
          api.status = "idle";
        }
        logger.info(`Workflow execution finished for version ${version.id}`);
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
