import { db, eq } from "@integramind/db";
import { dependencies, endpoints, funcs } from "@integramind/db/schema";

export async function wouldCreateCycle({
  dependentId,
  dependencyId,
}: {
  dependentId: string;
  dependencyId: string;
}): Promise<boolean> {
  if (dependentId === dependencyId) {
    return true;
  }

  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  async function dfs(currentId: string): Promise<boolean> {
    if (currentId === dependentId) {
      return true;
    }

    visited.add(currentId);
    recursionStack.add(currentId);

    const deps = await db.query.dependencies.findMany({
      where: (table, { and, eq }) =>
        and(
          eq(table.dependentId, currentId),
          eq(table.dependentType, "function"), // Only follow function dependencies
        ),
    });

    for (const dep of deps) {
      const nextId = dep.dependencyId;

      if (!visited.has(nextId)) {
        if (await dfs(nextId)) {
          return true;
        }
      } else if (recursionStack.has(nextId)) {
        return true;
      }
    }

    recursionStack.delete(currentId);
    return false;
  }

  return await dfs(dependencyId);
}

export async function haveMissingDependencies(
  funcId: string,
): Promise<boolean> {
  const deps = await db.query.dependencies.findMany({
    where: eq(dependencies.dependentId, funcId),
  });

  for (const dep of deps) {
    const func = await db.query.funcs.findFirst({
      where: eq(funcs.id, dep.dependencyId),
    });

    if (!func) {
      return true;
    }
  }

  return false;
}

export async function isFunctionReady({
  id,
}: {
  id: string;
}): Promise<boolean> {
  const func = await db.query.funcs.findFirst({
    where: eq(funcs.id, id),
  });

  if (!func) {
    return false;
  }

  const hasMissingDeps = await haveMissingDependencies(id);

  return Boolean(func.code && !hasMissingDeps);
}

export async function isEndpointReady({
  id,
}: {
  id: string;
}): Promise<boolean> {
  const endpoint = await db.query.endpoints.findFirst({
    where: eq(endpoints.id, id),
  });

  if (!endpoint) {
    return false;
  }

  const hasMissingDeps = await haveMissingDependencies(id);

  return Boolean(endpoint.code && !hasMissingDeps);
}
