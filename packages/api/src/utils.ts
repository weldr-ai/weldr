import { db, eq } from "@integramind/db";
import { funcDependencies } from "@integramind/db/schema";

export async function wouldCreateCycle({
  funcId,
  dependencyFuncId,
}: {
  funcId: string;
  dependencyFuncId: string;
}): Promise<boolean> {
  if (funcId === dependencyFuncId) {
    return true;
  }

  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  async function dfs(currentId: string): Promise<boolean> {
    if (currentId === funcId) {
      return true;
    }

    visited.add(currentId);
    recursionStack.add(currentId);

    const deps = await db.query.funcDependencies.findMany({
      where: eq(funcDependencies.funcId, currentId),
    });

    for (const dep of deps) {
      const nextId = dep.dependencyFuncId;

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

  return await dfs(dependencyFuncId);
}
