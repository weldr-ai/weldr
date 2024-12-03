import { db, eq } from "@integramind/db";
import { dependencies } from "@integramind/db/schema";

export async function wouldCreateCycle(
  targetPrimitiveId: string,
  sourcePrimitiveId: string,
): Promise<boolean> {
  const existingDep = await db.query.dependencies.findFirst({
    where:
      eq(dependencies.targetPrimitiveId, targetPrimitiveId) &&
      eq(dependencies.sourcePrimitiveId, sourcePrimitiveId),
  });

  if (existingDep) {
    return false;
  }

  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  async function dfs(currentId: string): Promise<boolean> {
    // If we reach the target primitive, we've found a cycle
    if (currentId === targetPrimitiveId) {
      return true;
    }

    visited.add(currentId);
    recursionStack.add(currentId);

    const deps = await db.query.dependencies.findMany({
      where: eq(dependencies.targetPrimitiveId, currentId),
    });

    for (const dep of deps) {
      const nextId = dep.sourcePrimitiveId;
      // Skip utility flow dependencies
      if (!nextId) continue;

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

  // Start DFS from the source primitive
  return await dfs(sourcePrimitiveId);
}
