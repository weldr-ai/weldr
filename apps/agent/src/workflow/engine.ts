import { promises as fs } from "node:fs";
import path from "node:path";
import { nanoid } from "@weldr/shared/nanoid";

// --- Configuration ---
const stateDir = path.join(process.cwd(), ".weldr");

// --- Type Definitions ---
export type Step<T> = {
  id: string;
  execute: ({ context }: { context: T }) => Promise<unknown> | unknown;
};

type SuspendCondition<T> = ({
  context,
}: {
  context: T;
}) => boolean | Promise<boolean>;

type WorkflowOperation<T> =
  | { type: "sequential"; step: Step<T> }
  | { type: "parallel"; steps: Step<T>[] }
  | { type: "suspend"; id: string; condition: SuspendCondition<T> };

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

async function executeWithRetry<T>({
  step,
  runId,
  retryConfig,
  context,
}: {
  step: Step<T>;
  runId: string;
  retryConfig: RetryConfig;
  context: T;
}): Promise<unknown> {
  let lastError: unknown;
  for (let i = 0; i < retryConfig.attempts; i++) {
    try {
      const output = await Promise.resolve(step.execute({ context }));
      return output;
    } catch (error) {
      lastError = error;
      if (i < retryConfig.attempts - 1) {
        console.log(
          `[workflow:${runId}] Step ${step.id} failed. Attempt ${
            i + 1
          } of ${retryConfig.attempts}. Retrying in ${retryConfig.delay}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, retryConfig.delay));
      }
    }
  }
  console.error(
    `[workflow:${runId}] Step ${step.id} failed after ${retryConfig.attempts} attempts.`,
  );
  throw lastError;
}

// --- Public API ---

export function createStep<T>({
  id,
  execute,
}: {
  id: string;
  execute: ({ context }: { context: T }) => Promise<unknown> | unknown;
}): Step<T> {
  return { id, execute };
}

export function createWorkflow<T>(
  config: WorkflowConfig = { retryConfig: { attempts: 3, delay: 1000 } },
) {
  const operations: WorkflowOperation<T>[] = [];
  const { retryConfig } = config;

  const api = {
    step(step: Step<T>) {
      operations.push({ type: "sequential", step });
      return api;
    },
    parallel(steps: Step<T>[]) {
      operations.push({ type: "parallel", steps });
      return api;
    },
    suspend(condition: SuspendCondition<T>) {
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
      context: T;
    }): Promise<void> {
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
        console.log(`[workflow:${runId}] Workflow has already completed.`);
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
              console.log(
                `[workflow:${runId}] Skipping completed step: ${step.id}`,
              );
              continue;
            }
            console.log(`[workflow:${runId}] Executing step: ${step.id}`);
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
              console.log(
                `[workflow:${runId}] Skipping completed parallel group.`,
              );
              continue;
            }

            console.log(
              `[workflow:${runId}] Executing parallel steps: ${stepsToRun
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
                console.log(
                  `[workflow:${runId}] Suspending workflow at: ${id}`,
                );
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
        console.log(`[workflow:${runId}] Workflow finished.`);
        state.status = "completed";
        await writeState({ statePath, state });
      } catch (error) {
        console.error(`[workflow:${runId}] Workflow failed.`, error);
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
