import { Logger } from "@/lib/logger";
import { and, db, eq, isNotNull } from "@weldr/db";
import {
  versions,
  workflowRuns,
  workflowStepExecutions,
} from "@weldr/db/schema";
import type { WorkflowContext } from "./context";

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
  | { status: "failed"; error: string }
  | { status: "skipped" };

type WorkflowState = {
  runId: string;
  versionId: string;
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

function findResumeIndex(
  operations: WorkflowOperation[],
  stepStates: Record<string, StepState>,
): number {
  for (let i = 0; i < operations.length; i++) {
    const op = operations[i];
    if (!op) continue;

    if (op.type === "sequential") {
      if (stepStates[op.step.id]?.status !== "completed") {
        return i;
      }
    } else if (op.type === "parallel") {
      const hasIncompleteStep = op.steps.some(
        (step) => stepStates[step.id]?.status !== "completed",
      );
      if (hasIncompleteStep) {
        return i;
      }
    } else if (op.type === "suspend") {
      if (stepStates[op.id]?.status !== "completed") {
        return i;
      }
    }
  }
  return operations.length;
}

async function readState({
  runId,
}: {
  runId: string;
}): Promise<WorkflowState | null> {
  const run = await db.query.workflowRuns.findFirst({
    where: eq(workflowRuns.id, runId),
    with: {
      stepExecutions: true,
    },
  });

  if (!run) {
    return null;
  }

  const stepStates: Record<string, StepState> = {};
  for (const step of run.stepExecutions) {
    if (step.status === "completed") {
      stepStates[step.stepId] = {
        status: "completed",
        output: step.output,
      };
    } else if (step.status === "failed") {
      stepStates[step.stepId] = {
        status: "failed",
        error: step.errorMessage || "Unknown error",
      };
    } else {
      stepStates[step.stepId] = { status: step.status };
    }
  }

  return {
    runId: run.id,
    versionId: run.versionId,
    stepStates,
    status: run.status,
    error: run.errorMessage || undefined,
  };
}

async function writeState({
  state,
}: {
  state: WorkflowState;
}): Promise<void> {
  await db.transaction(async (tx) => {
    // Update workflow run
    await tx
      .update(workflowRuns)
      .set({
        status: state.status,
        errorMessage: state.error,
        completedAt: state.status === "completed" ? new Date() : null,
      })
      .where(eq(workflowRuns.id, state.runId));

    // Update step executions
    for (const [stepId, stepState] of Object.entries(state.stepStates)) {
      const existingStep = await tx.query.workflowStepExecutions.findFirst({
        where: and(
          eq(workflowStepExecutions.workflowRunId, state.runId),
          eq(workflowStepExecutions.stepId, stepId),
        ),
      });

      const stepData = {
        status: stepState.status,
        output: stepState.status === "completed" ? stepState.output : null,
        errorMessage: stepState.status === "failed" ? stepState.error : null,
        startedAt: stepState.status === "running" ? new Date() : undefined,
        completedAt: ["completed", "failed", "skipped"].includes(
          stepState.status,
        )
          ? new Date()
          : null,
      };

      if (existingStep) {
        await tx
          .update(workflowStepExecutions)
          .set(stepData)
          .where(eq(workflowStepExecutions.id, existingStep.id));
      } else {
        await tx.insert(workflowStepExecutions).values({
          workflowRunId: state.runId,
          stepId,
          ...stepData,
        });
      }
    }
  });
}

async function deleteState({ runId }: { runId: string }): Promise<void> {
  await db.delete(workflowRuns).where(eq(workflowRuns.id, runId));
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
      const id = `suspend-${operations.length}`;
      operations.push({ type: "suspend", id, condition });
      return api;
    },
    async getRun({ runId }: { runId: string }): Promise<WorkflowState | null> {
      return await readState({ runId });
    },
    async listRuns(): Promise<string[]> {
      const runs = await db.query.workflowRuns.findMany({
        columns: { id: true },
        orderBy: (workflowRuns, { desc }) => [desc(workflowRuns.startedAt)],
      });
      return runs.map((run) => run.id);
    },
    async deleteRun({ runId }: { runId: string }): Promise<void> {
      await deleteState({ runId });
    },
    async markActiveVersionWorkflowAsFailed(projectId: string): Promise<void> {
      const activeVersion = await db.query.versions.findFirst({
        where: and(
          eq(versions.projectId, projectId),
          isNotNull(versions.activatedAt),
        ),
      });

      if (!activeVersion) return;

      const runningWorkflow = await db.query.workflowRuns.findFirst({
        where: and(
          eq(workflowRuns.versionId, activeVersion.id),
          eq(workflowRuns.status, "running"),
        ),
      });

      if (runningWorkflow) {
        await db
          .update(workflowRuns)
          .set({
            status: "failed",
            errorMessage: "Server restart detected - workflow interrupted",
            completedAt: new Date(),
          })
          .where(eq(workflowRuns.id, runningWorkflow.id));
      }
    },
    async recoverActiveVersionWorkflow(projectId: string): Promise<void> {
      const activeVersion = await db.query.versions.findFirst({
        where: and(
          eq(versions.projectId, projectId),
          isNotNull(versions.activatedAt),
        ),
      });

      if (!activeVersion) return;

      const crashedWorkflow = await db.query.workflowRuns.findFirst({
        where: and(
          eq(workflowRuns.versionId, activeVersion.id),
          eq(workflowRuns.status, "failed"),
          eq(
            workflowRuns.errorMessage,
            "Server restart detected - workflow interrupted",
          ),
        ),
        with: {
          stepExecutions: true,
        },
      });

      if (crashedWorkflow) {
        // Reset workflow and any running steps back to pending
        await db
          .update(workflowRuns)
          .set({
            status: "running",
            errorMessage: null,
            completedAt: null,
          })
          .where(eq(workflowRuns.id, crashedWorkflow.id));

        // Reset any running steps to pending
        for (const step of crashedWorkflow.stepExecutions) {
          if (step.status === "running") {
            await db
              .update(workflowStepExecutions)
              .set({
                status: "pending",
                startedAt: null,
              })
              .where(eq(workflowStepExecutions.id, step.id));
          }
        }
      }
    },
    async execute({
      runId,
      context,
      resetOn,
    }: {
      runId: string;
      context: WorkflowContext;
      resetOn?: ("suspended" | "failed")[];
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

      // Create or get existing workflow run
      let state = await readState({ runId });

      if (state && resetOn?.includes(state.status as "suspended" | "failed")) {
        logger.info(`Resetting workflow from status: ${state.status}`);
        for (const stepId of Object.keys(state.stepStates)) {
          state.stepStates[stepId] = { status: "pending" };
        }
        state.status = "running";
        state.error = undefined;
      }

      Logger.info(`State: ${JSON.stringify(state)}`);
      if (!state) {
        await db.insert(workflowRuns).values({
          id: runId,
          versionId: version.id,
          status: "running",
        });
        state = {
          runId,
          versionId: version.id,
          stepStates: {},
          status: "running",
        };
      }

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

      Logger.info(`State: ${JSON.stringify(state)}`);

      if (state.status === "completed") {
        logger.info("Workflow has already completed.");
        return;
      }

      Logger.info(`State: ${JSON.stringify(state)}`);

      state.status = "running";
      await writeState({ state });

      // Get the SSE stream writer to emit workflow progress
      const streamWriter = global.sseConnections?.get(
        context.get("version").chatId,
      );
      if (streamWriter) {
        await streamWriter.write({
          type: "workflow_run",
          runId,
          status: "running",
        });
      }

      try {
        // Find the starting point based on completed operations
        const startIndex = findResumeIndex(operations, state.stepStates);

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
            await writeState({ state });

            // Emit step progress
            if (streamWriter) {
              await streamWriter.write({
                type: "workflow_step",
                runId,
                stepId: step.id,
                status: "running",
              });
            }
            try {
              const output = await executeWithRetry({
                step,
                runId,
                retryConfig,
                context,
              });
              state.stepStates[step.id] = { status: "completed", output };
              await writeState({ state });

              // Emit step completion
              if (streamWriter) {
                await streamWriter.write({
                  type: "workflow_step",
                  runId,
                  stepId: step.id,
                  status: "completed",
                  output,
                });
              }
            } catch (error) {
              state.stepStates[step.id] = {
                status: "failed",
                error: error instanceof Error ? error.message : String(error),
              };
              await writeState({ state });

              // Emit step failure
              if (streamWriter) {
                await streamWriter.write({
                  type: "workflow_step",
                  runId,
                  stepId: step.id,
                  status: "failed",
                  errorMessage:
                    error instanceof Error ? error.message : String(error),
                });
              }
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
            await writeState({ state });

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

            await writeState({ state });

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
                await writeState({ state });

                // Emit workflow suspension
                if (streamWriter) {
                  await streamWriter.write({
                    type: "workflow_run",
                    runId,
                    status: "suspended",
                  });
                }
                return;
              }
              // Mark as completed so we don't re-evaluate on retry
              state.stepStates[id] = { status: "completed", output: undefined };
              await writeState({ state });
            }
          }
        }
        logger.info("Workflow finished.");
        state.status = "completed";
        await writeState({ state });

        // Emit workflow completion
        if (streamWriter) {
          await streamWriter.write({
            type: "workflow_run",
            runId,
            status: "completed",
          });
        }
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
        await writeState({ state });

        // Emit workflow failure
        if (streamWriter) {
          await streamWriter.write({
            type: "workflow_run",
            runId,
            status: "failed",
            errorMessage: state.error,
          });
        }
        throw error;
      }
    },
  };

  return api;
}
