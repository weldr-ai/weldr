import { db } from "@integramind/db";

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
