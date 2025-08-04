import type { WorkflowContext } from "@/workflow/context";

import { db, eq } from "@weldr/db";
import {
  chats,
  type declarations,
  dependencies,
  type integrationCategories,
  type integrations,
  type integrationTemplates,
  taskDependencies,
  tasks,
} from "@weldr/db/schema";
import type { Task } from "@weldr/shared/types";
import { createDeclarationFromTask } from "./declarations";

export type TaskWithRelations = typeof tasks.$inferSelect & {
  declaration:
    | (typeof declarations.$inferSelect & {
        integrations: {
          integration: typeof integrations.$inferSelect & {
            integrationTemplate: typeof integrationTemplates.$inferSelect & {
              category: typeof integrationCategories.$inferSelect;
            };
          };
        }[];
        dependencies: {
          dependency: typeof declarations.$inferSelect;
        }[];
      })
    | null;
  dependencies: {
    dependency: typeof tasks.$inferSelect;
  }[];
};

export async function createTasks({
  context,
  taskList,
}: {
  context: WorkflowContext;
  taskList: Task[];
}) {
  const project = context.get("project");
  const version = context.get("version");

  return await db.transaction(async (tx) => {
    const taskToDeclaration = new Map<
      number,
      typeof declarations.$inferSelect
    >();
    const tasksMap = new Map<
      number,
      {
        numericId: number;
        type: "declaration" | "generic";
        dbId: string;
        dependencies: number[];
      }
    >();

    await Promise.all(
      taskList.map(async (task) => {
        const [chat] = await tx
          .insert(chats)
          .values({
            userId: version.userId,
            projectId: project.id,
          })
          .returning();

        if (!chat) {
          throw new Error("Failed to insert chat");
        }

        const [insertedTask] = await tx
          .insert(tasks)
          .values({
            data: task,
            versionId: version.id,
            chatId: chat.id,
            status: "pending",
          })
          .returning();

        if (!insertedTask) {
          throw new Error("Failed to insert task");
        }

        if (task.type === "declaration") {
          const declaration = await createDeclarationFromTask({
            context,
            task: insertedTask,
          });

          if (!declaration) {
            throw new Error("Failed to create declaration");
          }

          taskToDeclaration.set(task.id, declaration);
        }

        tasksMap.set(task.id, {
          numericId: task.id,
          dbId: insertedTask.id,
          type: task.type,
          dependencies: task.dependencies || [],
        });
      }),
    );

    const taskDependenciesInserts: Array<{
      dependentId: string;
      dependencyId: string;
    }> = [];

    const declarationDependenciesInserts: Array<{
      dependentId: string;
      dependencyId: string;
    }> = [];

    const insertedTasks = tasksMap.values();

    for (const insertedTask of insertedTasks) {
      for (const depId of insertedTask.dependencies) {
        const dependency = tasksMap.get(depId);

        if (!dependency) {
          throw new Error("Dependency task not found");
        }

        taskDependenciesInserts.push({
          dependentId: insertedTask.dbId,
          dependencyId: dependency.dbId,
        });

        // Create declaration dependencies
        if (
          insertedTask.type === "declaration" &&
          dependency.type === "declaration"
        ) {
          const dependentId = taskToDeclaration.get(insertedTask.numericId);
          const dependencyId = taskToDeclaration.get(dependency.numericId);

          if (!dependentId || !dependencyId) {
            throw new Error(
              `[createTasks:project_${project.id}:version_${version.id}] Declaration ID not found for dependency mapping`,
            );
          }

          declarationDependenciesInserts.push({
            dependentId: dependentId.id,
            dependencyId: dependencyId.id,
          });
        }
      }
    }

    if (taskDependenciesInserts.length > 0) {
      await tx.insert(taskDependencies).values(taskDependenciesInserts);
    }

    if (declarationDependenciesInserts.length > 0) {
      await tx.insert(dependencies).values(declarationDependenciesInserts);
    }
  });
}

export async function getTasksWithDependencies(
  versionId: string,
): Promise<TaskWithRelations[]> {
  return await db.query.tasks.findMany({
    where: (tasks) => eq(tasks.versionId, versionId),
    with: {
      dependencies: {
        with: {
          dependency: true,
        },
      },
      declaration: {
        with: {
          integrations: {
            with: {
              integration: {
                with: {
                  integrationTemplate: {
                    with: {
                      category: true,
                    },
                  },
                },
              },
            },
          },
          dependencies: {
            with: {
              dependency: true,
            },
          },
        },
      },
    },
  });
}

export async function getTaskExecutionPlan({
  versionId,
}: {
  versionId: string;
}): Promise<TaskWithRelations[]> {
  const tasks = await getTasksWithDependencies(versionId);

  // Filter only pending tasks
  const pendingTasks = tasks.filter((task) => task.status === "pending");

  if (pendingTasks.length === 0) {
    return [];
  }

  const orderedTasks = orderTasks(pendingTasks);
  return orderedTasks;
}

function orderTasks(tasks: TaskWithRelations[]): TaskWithRelations[] {
  const taskMap = new Map<string, TaskWithRelations>();
  for (const task of tasks) {
    taskMap.set(task.id, task);
  }

  const inDegree = new Map<string, number>();
  const adjList = new Map<string, string[]>();

  // Initialize in-degree and adjacency list
  for (const task of tasks) {
    inDegree.set(task.id, 0);
    adjList.set(task.id, []);
  }

  // Build the dependency graph
  for (const task of tasks) {
    for (const dependency of task.dependencies) {
      const dependencyId = dependency.dependency.id;
      const neighbors = adjList.get(dependencyId);
      if (neighbors) {
        neighbors.push(task.id);
        inDegree.set(task.id, (inDegree.get(task.id) ?? 0) + 1);
      }
    }
  }

  // Topological sort using Kahn's algorithm
  const queue: string[] = [];
  for (const [id, degree] of inDegree.entries()) {
    if (degree === 0) {
      queue.push(id);
    }
  }

  const sortedTasks: TaskWithRelations[] = [];
  while (queue.length > 0) {
    const taskId = queue.shift();
    if (!taskId) {
      break;
    }

    const task = taskMap.get(taskId);
    if (task) {
      sortedTasks.push(task);
    }

    const neighbors = adjList.get(taskId) ?? [];
    for (const neighborId of neighbors) {
      const currentInDegree = (inDegree.get(neighborId) ?? 0) - 1;
      inDegree.set(neighborId, currentInDegree);
      if (currentInDegree === 0) {
        queue.push(neighborId);
      }
    }
  }

  // Check for circular dependencies
  if (sortedTasks.length !== tasks.length) {
    const unprocessedTasks = tasks.filter(
      (task) => !sortedTasks.find((sortedTask) => sortedTask.id === task.id),
    );
    const unprocessedTaskNames = unprocessedTasks
      .map((task) => task.data.summary ?? task.id)
      .join(", ");
    throw new Error(
      `Circular dependency detected in tasks. Could not resolve order for: ${unprocessedTaskNames}`,
    );
  }

  return sortedTasks;
}
