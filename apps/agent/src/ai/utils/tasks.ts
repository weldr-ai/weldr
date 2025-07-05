import type { WorkflowContext } from "@/workflow/context";
import { db, eq } from "@weldr/db";
import { chats, taskDependencies, tasks } from "@weldr/db/schema";
import type { Task } from "@weldr/shared/types";

export type TaskWithDependencies = typeof tasks.$inferSelect & {
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
    const insertedTasks = await Promise.all(
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

        return {
          numericId: task.id,
          dbId: insertedTask.id,
          dependencies: task.dependencies || [],
        };
      }),
    );

    const idMapping = new Map<number, string>();
    for (const insertedTask of insertedTasks) {
      idMapping.set(insertedTask.numericId, insertedTask.dbId);
    }

    const dependencyInserts: Array<{
      taskId: string;
      dependencyId: string;
    }> = [];

    for (const insertedTask of insertedTasks) {
      if (insertedTask.dependencies.length > 0) {
        for (const depId of insertedTask.dependencies) {
          const dependsOnTaskId = idMapping.get(depId);
          if (dependsOnTaskId) {
            dependencyInserts.push({
              taskId: insertedTask.dbId,
              dependencyId: dependsOnTaskId,
            });
          }
        }
      }
    }

    if (dependencyInserts.length > 0) {
      await tx.insert(taskDependencies).values(dependencyInserts);
    }

    return insertedTasks.map((t) => ({
      id: t.dbId,
      numericId: t.numericId,
    }));
  });
}

export async function getTasksWithDependencies(
  versionId: string,
): Promise<TaskWithDependencies[]> {
  return await db.query.tasks.findMany({
    where: (tasks) => eq(tasks.versionId, versionId),
    with: {
      dependencies: {
        with: {
          dependency: true,
        },
      },
    },
  });
}

export async function getTaskExecutionPlan({
  versionId,
}: {
  versionId: string;
}): Promise<TaskWithDependencies[]> {
  const tasks = await getTasksWithDependencies(versionId);

  // Filter only pending tasks
  const pendingTasks = tasks.filter((task) => task.status === "pending");

  if (pendingTasks.length === 0) {
    return [];
  }

  const orderedTasks = orderTasks(pendingTasks);
  return orderedTasks;
}

function orderTasks(tasks: TaskWithDependencies[]): TaskWithDependencies[] {
  const taskMap = new Map<string, TaskWithDependencies>();
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

  const sortedTasks: TaskWithDependencies[] = [];
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
