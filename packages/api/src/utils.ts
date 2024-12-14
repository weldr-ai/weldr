import { db, eq } from "@integramind/db";
import { edges } from "@integramind/db/schema";
import type { Flow, Func } from "@integramind/shared/types";

export async function wouldCreateCycle({
  targetId,
  localSourceId,
}: {
  targetId: string;
  localSourceId: string;
}): Promise<boolean> {
  const existingDep = await db.query.edges.findFirst({
    where:
      eq(edges.targetId, targetId) && eq(edges.localSourceId, localSourceId),
  });

  if (existingDep) {
    return false;
  }

  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  async function dfs(currentId: string): Promise<boolean> {
    // If we reach the target func, we've found a cycle
    if (currentId === targetId) {
      return true;
    }

    visited.add(currentId);
    recursionStack.add(currentId);

    const deps = await db.query.edges.findMany({
      where: eq(edges.targetId, currentId),
    });

    for (const dep of deps) {
      const nextId = dep.localSourceId;
      // Skip utility flow edges
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

  // Start DFS from the source func
  return await dfs(localSourceId);
}

export function canRunFlow(flow: Flow & { funcs: Func[] }) {
  let canRun = true;

  for (const func of flow.funcs) {
    if (
      !func.name ||
      !func.description ||
      !func.code ||
      !func.edgeCases ||
      !func.logicalSteps ||
      !func.errorHandling
    ) {
      canRun = false;
      break;
    }
  }

  if (!flow.inputSchema || !flow.outputSchema) {
    canRun = false;
  }

  return canRun;
}

export function canRunFunc(func: Func) {
  if (!func.name || !func.description || !func.code) {
    return false;
  }

  return true;
}
