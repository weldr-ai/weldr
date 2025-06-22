import { promises as fs } from "node:fs";
import path from "node:path";
import { Logger } from "@/lib/logger";
import { nanoid } from "@weldr/shared/nanoid";
import type { WorkflowContext } from "./context";

// --- Configuration ---
const stateDir = path.join(process.cwd(), ".weldr");

// --- Type Definitions ---
export type Step = {
  id: string;
  execute: ({
    context,
  }: { context: WorkflowContext }) => Promise<unknown> | unknown;
};

type SuspendCondition = ({
  context,
}: {
  context: WorkflowContext;
}) => boolean | Promise<boolean>;

type WorkflowOperation =
  | { type: "sequential"; step: Step }
  | { type: "parallel"; steps: Step[] }
  | { type: "suspend"; id: string; condition: SuspendCondition };

type StepState =
  | { status: "pending" }
  | { status: "running" }
  | { status: "completed"; output: unknown }
  | { status: "failed"; error: string };

type WorkflowState = {
  runId: string;
  stepStates: Record<string, StepState>;
  status: "running" | "completed" | "failed" | "suspended";
  error?: string;
};

type RetryConfig = {
  attempts: number;
  delay: number; // in milliseconds
};

export type WorkflowConfig = {
  retryConfig: RetryConfig;
};

// --- Private Helper Functions ---

async function readState({
  statePath,
}: {
  statePath: string;
}): Promise<WorkflowState> {
  try {
    const data = await fs.readFile(statePath, "utf-8");
    return JSON.parse(data) as WorkflowState;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return {
        runId: path.basename(statePath, ".json"),
        stepStates: {},
        status: "running",
      };
    }
    throw error;
  }
}

async function writeState({
  statePath,
  state,
}: {
  statePath: string;
  state: WorkflowState;
}): Promise<void> {
  const tempPath = `${statePath}.${Date.now()}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(state, null, 2), "utf-8");
  await fs.rename(tempPath, statePath);
}

async function deleteState({
  statePath,
}: { statePath: string }): Promise<void> {
  try {
    await fs.unlink(statePath);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      // File already deleted, which is fine.
      return;
    }
    throw error;
  }
}

async function executeWithRetry({
  step,
  runId,
  retryConfig,
  context,
}: {
  step: Step;
  runId: string;
  retryConfig: RetryConfig;
  context: WorkflowContext;
}): Promise<unknown> {
  const project = context.get("project");
  const version = context.get("version");

  // Create contextual logger with base tags and extras
  const logger = Logger.get({
    tags: ["executeWithRetry"],
    extra: {
      runId,
      stepId: step.id,
      projectId: project.id,
      versionId: version.id,
    },
  });

  let lastError: unknown;

  for (let i = 0; i < retryConfig.attempts; i++) {
    try {
      const output = await Promise.resolve(step.execute({ context }));
      return output;
    } catch (error) {
      lastError = error;
      if (i < retryConfig.attempts - 1) {
        logger.info(
          `Step ${step.id} failed. Attempt ${i + 1} of ${retryConfig.attempts}. Retrying in ${retryConfig.delay}ms...`,
          {
            extra: {
              attempt: i + 1,
              maxAttempts: retryConfig.attempts,
              delay: retryConfig.delay,
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
      extra: {
        maxAttempts: retryConfig.attempts,
      },
    },
  );
  throw lastError;
}

// --- Public API ---

export function createStep<T>({
  id,
  execute,
}: {
  id: string;
  execute: ({
    context,
  }: { context: WorkflowContext }) => Promise<unknown> | unknown;
}): Step {
  return { id, execute };
}

export function createWorkflow(
  config: WorkflowConfig = { retryConfig: { attempts: 3, delay: 1000 } },
) {
  const operations: WorkflowOperation[] = [];
  const { retryConfig } = config;

  const api = {
    step(step: Step) {
      operations.push({ type: "sequential", step });
      return api;
    },
    parallel(steps: Step[]) {
      operations.push({ type: "parallel", steps });
      return api;
    },
    suspend(condition: SuspendCondition) {
      const id = `suspend-${nanoid()}`;
      operations.push({ type: "suspend", id, condition });
      return api;
    },
    async getRun({ runId }: { runId: string }): Promise<WorkflowState | null> {
      const statePath = path.join(stateDir, `${runId}.json`);
      try {
        const data = await fs.readFile(statePath, "utf-8");
        return JSON.parse(data) as WorkflowState;
      } catch (error) {
        if (
          error instanceof Error &&
          "code" in error &&
          error.code === "ENOENT"
        ) {
          return null;
        }
        throw error;
      }
    },
    async listRuns(): Promise<string[]> {
      try {
        await fs.mkdir(stateDir, { recursive: true });
        const files = await fs.readdir(stateDir);
        return files
          .filter((file) => file.endsWith(".json"))
          .map((file) => path.basename(file, ".json"));
      } catch (error) {
        if (
          error instanceof Error &&
          "code" in error &&
          error.code === "ENOENT"
        ) {
          return [];
        }
        throw error;
      }
    },
    async deleteRun({ runId }: { runId: string }): Promise<void> {
      const statePath = path.join(stateDir, `${runId}.json`);
      await deleteState({ statePath });
    },
    async execute({
      runId,
      context,
    }: {
      runId: string;
      context: WorkflowContext;
    }): Promise<void> {
      const project = context.get("project");
      const version = context.get("version");

      // Create contextual logger with base tags and extras
      const logger = Logger.get({
        tags: ["execute"],
        extra: {
          runId,
          projectId: project.id,
          versionId: version.id,
        },
      });

      await fs.mkdir(stateDir, { recursive: true });
      const statePath = path.join(stateDir, `${runId}.json`);

      await deleteState({ statePath });
      const state = await readState({ statePath });

      for (const op of operations) {
        if (op.type === "sequential") {
          if (!state.stepStates[op.step.id]) {
            state.stepStates[op.step.id] = { status: "pending" };
          }
        } else if (op.type === "parallel") {
          for (const step of op.steps) {
            if (!state.stepStates[step.id]) {
              state.stepStates[step.id] = { status: "pending" };
            }
          }
        } else if (op.type === "suspend") {
          if (!state.stepStates[op.id]) {
            state.stepStates[op.id] = { status: "pending" };
          }
        }
      }

      if (state.status === "completed") {
        logger.info("Workflow has already completed.");
        return;
      }

      state.status = "running";
      await writeState({ statePath, state });

      try {
        const startIndex = 0;

        for (let i = startIndex; i < operations.length; i++) {
          const op = operations[i];
          if (!op) continue;
          if (op.type === "sequential") {
            const { step } = op;
            if (state.stepStates[step.id]?.status === "completed") {
              logger.info(`Skipping completed step: ${step.id}`, {
                extra: { stepId: step.id },
              });
              continue;
            }
            logger.info(`Executing step: ${step.id}`, {
              extra: { stepId: step.id },
            });
            state.stepStates[step.id] = { status: "running" };
            await writeState({ statePath, state });
            try {
              const output = await executeWithRetry({
                step,
                runId,
                retryConfig,
                context,
              });
              state.stepStates[step.id] = { status: "completed", output };
              await writeState({ statePath, state });
            } catch (error) {
              state.stepStates[step.id] = {
                status: "failed",
                error: error instanceof Error ? error.message : String(error),
              };
              await writeState({ statePath, state });
              throw error;
            }
          }

          if (op.type === "parallel") {
            const { steps } = op;
            const stepsToRun = steps.filter(
              (s) => state.stepStates[s.id]?.status !== "completed",
            );

            if (stepsToRun.length === 0) {
              logger.info("Skipping completed parallel group.");
              continue;
            }

            logger.info(
              `Executing parallel steps: ${stepsToRun
                .map((s) => s.id)
                .join(", ")}`,
            );

            for (const step of stepsToRun) {
              state.stepStates[step.id] = { status: "running" };
            }
            await writeState({ statePath, state });

            const promises = stepsToRun.map((step) =>
              executeWithRetry({
                step,
                runId,
                retryConfig,
                context,
              }),
            );

            const results = await Promise.allSettled(promises);
            let workflowError: unknown;

            results.forEach((result, index) => {
              const step = stepsToRun[index];
              if (!step) return;

              if (result.status === "fulfilled") {
                state.stepStates[step.id] = {
                  status: "completed",
                  output: result.value,
                };
              } else {
                state.stepStates[step.id] = {
                  status: "failed",
                  error:
                    result.reason instanceof Error
                      ? result.reason.message
                      : String(result.reason),
                };
                if (!workflowError) {
                  workflowError = result.reason;
                }
              }
            });

            await writeState({ statePath, state });

            if (workflowError) {
              throw workflowError;
            }
          }

          if (op.type === "suspend") {
            const { id, condition } = op;
            if (state.stepStates[id]?.status !== "completed") {
              const shouldSuspend = await Promise.resolve(
                condition({ context }),
              );

              if (shouldSuspend) {
                state.status = "suspended";
                await writeState({ statePath, state });
                return;
              }
              // Mark as completed so we don't re-evaluate on retry
              state.stepStates[id] = { status: "completed", output: undefined };
              await writeState({ statePath, state });
            }
          }
        }
        logger.info("Workflow finished.");
        state.status = "completed";
        await writeState({ statePath, state });
      } catch (error) {
        logger.error("Workflow failed.", {
          extra: { error },
        });
        state.status = "failed";
        if (error instanceof Error) {
          state.error = error.message;
        } else {
          state.error = "An unknown error occurred.";
        }
        await writeState({ statePath, state });
        throw error;
      }
    },
  };

  return api;
}
