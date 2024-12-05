import { db, eq } from "@integramind/db";
import { edges } from "@integramind/db/schema";
import type { Flow, Primitive } from "@integramind/shared/types";

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
    // If we reach the target primitive, we've found a cycle
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

  // Start DFS from the source primitive
  return await dfs(localSourceId);
}

export function canRunFlow(flow: Flow & { primitives: Primitive[] }) {
  let canRun = true;

  for (const primitive of flow.primitives) {
    if (
      !primitive.name ||
      !primitive.description ||
      !primitive.code ||
      !primitive.edgeCases ||
      !primitive.logicalSteps ||
      !primitive.errorHandling
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

export function canRunPrimitive(primitive: Primitive) {
  if (!primitive.name || !primitive.description || !primitive.code) {
    return false;
  }

  return true;
}
