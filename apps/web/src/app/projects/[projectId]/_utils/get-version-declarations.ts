import type { RouterOutputs } from "@weldr/api";

export const getVersionDeclarations = (
  version: RouterOutputs["branches"]["byId"]["headVersion"],
) => {
  const declarations = version.declarations
    .filter((declaration) => declaration.declaration.node)
    .map((declaration) => declaration.declaration);

  const declarationToCanvasNodeMap = new Map(
    declarations.map((declaration) => [declaration.id, declaration.node?.id]),
  );

  return declarations.map((declaration) => ({
    declaration,
    edges: declaration.dependencies.map((dependency) => ({
      dependencyId: declarationToCanvasNodeMap.get(dependency.dependencyId),
      dependentId: declarationToCanvasNodeMap.get(dependency.dependentId),
    })),
  }));
};
