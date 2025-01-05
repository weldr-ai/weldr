import { createHash } from "node:crypto";
import { type InferSelectModel, db } from "@integramind/db";
import type { endpoints, funcs } from "@integramind/db/schema";
import type {
  JsonSchema,
  OpenApiEndpointSpec,
  Package,
  RawContent,
  RequirementResource,
} from "@integramind/shared/types";

export async function wouldCreateCycle({
  dependentId,
  dependentType,
  dependencyId,
  dependencyType,
}: {
  dependentId: string;
  dependentType: "function" | "endpoint";
  dependencyId: string;
  dependencyType: "function" | "endpoint";
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
          eq(table.dependentType, dependentType),
        ),
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

export async function isFunctionReady(
  func: InferSelectModel<typeof funcs>,
): Promise<boolean> {
  if (!func.code) {
    return false;
  }
  return true;
}

export async function isEndpointReady(
  endpoint: InferSelectModel<typeof endpoints>,
): Promise<boolean> {
  if (!endpoint.code) {
    return false;
  }
  return true;
}

export function generateFuncVersionHash(version: {
  name: string;
  inputSchema: JsonSchema;
  outputSchema: JsonSchema;
  rawDescription: RawContent;
  behavior: RawContent;
  code: string;
  packages: Package[];
  resources: RequirementResource[];
}) {
  const contentToHash = JSON.stringify({
    name: version.name,
    inputSchema: version.inputSchema,
    outputSchema: version.outputSchema,
    rawDescription: version.rawDescription,
    behavior: version.behavior,
    code: version.code,
    packages: version.packages,
    resources: version.resources,
  });
  return createHash("sha256").update(contentToHash).digest("hex");
}

export function generateEndpointVersionHash(version: {
  openApiSpec: OpenApiEndpointSpec;
  code: string;
  packages: Package[];
  resources: RequirementResource[];
}) {
  const contentToHash = JSON.stringify({
    code: version.code,
    packages: version.packages,
    resources: version.resources,
    openApiSpec: version.openApiSpec,
  });
  return createHash("sha256").update(contentToHash).digest("hex");
}

// const isSchemaEqual = (
//   schema1: JsonSchema | null,
//   schema2: JsonSchema | null,
// ): boolean => {
//   if (schema1 === null && schema2 === null) {
//     return true;
//   }

//   if (schema1 === null || schema2 === null) {
//     return false;
//   }

//   return JSON.stringify(schema1) === JSON.stringify(schema2);
// };

export async function hasDependencyMismatch(
  dependentVersionId: string,
  type: "func" | "endpoint",
): Promise<boolean> {
  // const dependentVersion =
  //   type === "func"
  //     ? await db.query.funcVersions.findFirst({
  //         where: eq(funcVersions.id, dependentVersionId),
  //         with: {
  //           dependencies: {
  //             with: {
  //               dependencyVersion: {
  //                 columns: {
  //                   funcId: true,
  //                   hash: true,
  //                   inputSchema: true,
  //                   outputSchema: true,
  //                 },
  //               },
  //             },
  //           },
  //         },
  //       })
  //     : await db.query.endpointVersions.findFirst({
  //         where: eq(endpointVersions.id, dependentVersionId),
  //         with: {
  //           dependencies: {
  //             with: {
  //               dependencyVersion: {
  //                 columns: {
  //                   funcId: true,
  //                   hash: true,
  //                   inputSchema: true,
  //                   outputSchema: true,
  //                 },
  //               },
  //             },
  //           },
  //         },
  //       });

  // if (!dependentVersion) {
  //   return false;
  // }

  // for (const dep of dependentVersion.dependencies) {
  //   if (!dep.dependencyVersion || !dep.dependencyVersion.hash) {
  //     return false;
  //   }

  //   const func = await db.query.funcs.findFirst({
  //     where: eq(funcs.id, dep.dependencyVersion.funcId),
  //     with: {
  //       currentVersion: {
  //         columns: {
  //           hash: true,
  //           inputSchema: true,
  //           outputSchema: true,
  //         },
  //       },
  //     },
  //   });

  //   if (!func || !func.currentVersion || !func.currentVersion.hash) {
  //     return false;
  //   }

  //   // Check if the hash is different
  //   if (func.currentVersion.hash !== dep.dependencyVersion.hash) {
  //     if (
  //       !isSchemaEqual(
  //         func.currentVersion.inputSchema,
  //         dep.dependencyVersion.inputSchema,
  //       )
  //     ) {
  //       return false;
  //     }

  //     if (
  //       !isSchemaEqual(
  //         func.currentVersion.outputSchema,
  //         dep.dependencyVersion.outputSchema,
  //       )
  //     ) {
  //       return false;
  //     }
  //   }
  // }

  return true;
}

export async function isMissingDependencies(
  dependentVersionId: string,
  type: "func" | "endpoint",
): Promise<boolean> {
  // const dependentVersion =
  //   type === "func"
  //     ? await db.query.funcVersions.findFirst({
  //         where: eq(funcVersions.id, dependentVersionId),
  //         with: {
  //           dependencies: true,
  //         },
  //       })
  //     : await db.query.endpointVersions.findFirst({
  //         where: eq(endpointVersions.id, dependentVersionId),
  //         with: {
  //           dependencies: true,
  //         },
  //       });

  // if (!dependentVersion) {
  //   return false;
  // }

  // return dependentVersion.dependencies.some((dep) => !dep.dependencyVersionId);
  return true;
}
