import { and, db, eq } from "@weldr/db";
import {
  declarations,
  type integrationTemplates,
  type integrations,
} from "@weldr/db/schema";
import type { DeclarationSpecs } from "@weldr/shared/types/declarations";

export type Declaration = typeof declarations.$inferSelect & {
  specs: DeclarationSpecs;
  integrations: {
    integration: typeof integrations.$inferSelect & {
      integrationTemplate: typeof integrationTemplates.$inferSelect;
    };
  }[];
  dependencies: {
    dependency: typeof declarations.$inferSelect;
  }[];
};

function orderDeclarations(declarations: Declaration[]): Declaration[] {
  const declarationMap = new Map<string, Declaration>();
  for (const d of declarations) {
    declarationMap.set(d.id, d);
  }

  const inDegree = new Map<string, number>();
  const adjList = new Map<string, string[]>();

  for (const decl of declarations) {
    inDegree.set(decl.id, 0);
    adjList.set(decl.id, []);
  }

  for (const decl of declarations) {
    for (const dep of decl.dependencies) {
      const dependencyId = dep.dependency.id;
      const neighbors = adjList.get(dependencyId);
      if (neighbors) {
        neighbors.push(decl.id);
        inDegree.set(decl.id, (inDegree.get(decl.id) ?? 0) + 1);
      }
    }
  }

  const queue: string[] = [];
  for (const [id, degree] of inDegree.entries()) {
    if (degree === 0) {
      queue.push(id);
    }
  }

  const sortedDeclarations: Declaration[] = [];
  while (queue.length > 0) {
    const uId = queue.shift();
    if (!uId) {
      break;
    }
    const u = declarationMap.get(uId);
    if (u) {
      sortedDeclarations.push(u);
    }

    const neighbors = adjList.get(uId) ?? [];
    for (const vId of neighbors) {
      const currentInDegree = (inDegree.get(vId) ?? 0) - 1;
      inDegree.set(vId, currentInDegree);
      if (currentInDegree === 0) {
        queue.push(vId);
      }
    }
  }

  if (sortedDeclarations.length !== declarations.length) {
    const unproccessedDecls = declarations.filter(
      (d) => !sortedDeclarations.find((sd) => sd.id === d.id),
    );
    const unproccessedDeclNames = unproccessedDecls
      .map((d) => d.data?.name ?? d.uri ?? d.id)
      .join(", ");
    throw new Error(
      `Circular dependency detected. Could not resolve order for: ${unproccessedDeclNames}`,
    );
  }

  return sortedDeclarations;
}

export async function getExecutionPlan({
  projectId,
}: {
  projectId: string;
}): Promise<Declaration[]> {
  const declarationList = await db.query.declarations.findMany({
    where: and(
      eq(declarations.projectId, projectId),
      eq(declarations.progress, "pending"),
    ),
    with: {
      integrations: {
        with: {
          integration: {
            with: {
              integrationTemplate: true,
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
  });

  const orderedDeclarations = orderDeclarations(
    declarationList as Declaration[],
  );

  return orderedDeclarations as Declaration[];
}
