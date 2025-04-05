import {
  type Db,
  type InferSelectModel,
  type Tx,
  and,
  db,
  eq,
  inArray,
} from "@weldr/db";
import { type declarations, dependencies } from "@weldr/db/schema";

export async function wouldCreateCycle({
  dependentId,
  dependencyId,
  db: transactionDb = db,
}: {
  dependentId: string;
  dependencyId: string;
  db?: Db | Tx;
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

    const deps = await transactionDb.query.dependencies.findMany({
      where: eq(dependencies.dependentId, currentId),
    });

    for (const dep of deps) {
      const nextId = dep.dependencyId;

      if (!nextId) {
        throw new Error("Dependency version ID is null");
      }

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

export async function isDeclarationReady(
  declaration: InferSelectModel<typeof declarations>,
): Promise<boolean> {
  if (!declaration.specs) {
    return false;
  }
  return true;
}

export async function getDependencyChain(db: Db, declarationIds: string[]) {
  const dependenciesResult = await db.query.dependencies.findMany({
    where: and(
      inArray(dependencies.dependentId, declarationIds),
      inArray(dependencies.dependencyId, declarationIds),
    ),
  });

  const dependencyChain = new Map<
    string,
    {
      id: string;
      type: "smooth";
      source: string;
      target: string;
    }
  >();

  for (const d of dependenciesResult) {
    if (d.dependentId && d.dependencyId) {
      const id = `${d.dependentId}-${d.dependencyId}`;
      dependencyChain.set(id, {
        id,
        type: "smooth",
        source: d.dependentId,
        target: d.dependencyId,
      });
    }
  }

  return Array.from(dependencyChain.values());
}
