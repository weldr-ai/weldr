import { createHash } from "node:crypto";
import {
  type Db,
  type InferSelectModel,
  type Tx,
  and,
  db,
  eq,
  inArray,
} from "@integramind/db";
import {
  endpoints,
  funcs,
  versionEndpoints,
  versionFuncs,
  versionPackages,
  versions,
} from "@integramind/db/schema";
import type {
  JsonSchema,
  OpenApiEndpointSpec,
  Package,
  RawContent,
  ResourceMetadata,
} from "@integramind/shared/types";
import type { insertVersionSchema } from "@integramind/shared/validators/versions";
import { TRPCError } from "@trpc/server";
import type { z } from "zod";

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
  errors: string;
  docs: string;
  code: string;
  packages: Package[];
  resources: ResourceMetadata[];
}) {
  const contentToHash = JSON.stringify({
    name: version.name,
    inputSchema: version.inputSchema,
    outputSchema: version.outputSchema,
    rawDescription: version.rawDescription,
    behavior: version.behavior,
    errors: version.errors,
    docs: version.docs,
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
  resources: ResourceMetadata[];
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

export async function createVersion({
  db,
  tx,
  input,
}: {
  db: Db;
  tx?: Tx;
  input: z.infer<typeof insertVersionSchema>;
}) {
  const runInTransaction = async (transactionDb: Tx | Db) => {
    // Get current version with functions and their packages
    const currentVersion = await transactionDb.query.versions.findFirst({
      where: and(
        eq(versions.projectId, input.projectId),
        eq(versions.isActive, true),
      ),
      with: {
        funcs: {
          with: {
            func: true,
          },
        },
        endpoints: {
          with: {
            endpoint: true,
          },
        },
      },
    });

    if (!currentVersion) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create new version",
      });
    }

    // Deactivate the current version
    await transactionDb
      .update(versions)
      .set({ isActive: false })
      .where(eq(versions.id, currentVersion.id));

    const nextVersionNumber = (currentVersion.versionNumber ?? 0) + 1;
    const newVersion = await transactionDb
      .insert(versions)
      .values({
        projectId: input.projectId,
        isActive: true,
        versionName: input.versionName,
        versionNumber: nextVersionNumber,
        userId: input.userId,
        parentVersionId: currentVersion.id,
        messageId: input.messageId,
      })
      .returning()
      .then(([version]) => version);

    const versionFuncIdsSet = new Set<string>([...(input.addedFuncIds ?? [])]);
    const versionEndpointIdsSet = new Set<string>([
      ...(input.addedEndpointIds ?? []),
    ]);

    // Collect functions that will be in the new version
    for (const funcId of currentVersion.funcs) {
      if (!input.deletedFuncIds?.includes(funcId.funcId)) {
        versionFuncIdsSet.add(funcId.funcId);
      }
    }

    // Collect endpoints that will be in the new version
    for (const endpointId of currentVersion.endpoints) {
      if (!input.deletedEndpointIds?.includes(endpointId.endpointId)) {
        versionEndpointIdsSet.add(endpointId.endpointId);
      }
    }

    if (!newVersion || !newVersion.id) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create new version",
      });
    }

    const versionFuncIds = Array.from(versionFuncIdsSet);
    const versionEndpointIds = Array.from(versionEndpointIdsSet);

    // Insert functions for the new version
    if (versionFuncIds.length > 0) {
      await transactionDb.insert(versionFuncs).values(
        versionFuncIds.map((funcId) => ({
          funcId,
          versionId: newVersion.id,
        })),
      );
    }

    // Insert endpoints for the new version
    if (versionEndpointIds.length > 0) {
      await transactionDb.insert(versionEndpoints).values(
        versionEndpointIds.map((endpointId) => ({
          endpointId,
          versionId: newVersion.id,
        })),
      );
    }

    // Get all packages used by functions in the new version
    const newVersionFuncs = await transactionDb.query.funcs.findMany({
      where: inArray(funcs.id, versionFuncIds),
      with: {
        packages: true,
      },
    });

    // Get all packages used by endpoints in the new version
    const newVersionEndpoints = await transactionDb.query.endpoints.findMany({
      where: inArray(endpoints.id, versionEndpointIds),
      with: {
        packages: true,
      },
    });

    // Collect all unique package IDs that are in use
    const activePackageIds = new Set<string>();

    // Add packages from functions
    for (const func of newVersionFuncs) {
      for (const pkg of func.packages) {
        activePackageIds.add(pkg.packageId);
      }
    }

    // Add packages from endpoints
    for (const endpoint of newVersionEndpoints) {
      for (const pkg of endpoint.packages) {
        activePackageIds.add(pkg.packageId);
      }
    }

    // Insert active packages into version_packages
    if (activePackageIds.size > 0) {
      await transactionDb.insert(versionPackages).values(
        Array.from(activePackageIds).map((packageId) => ({
          packageId,
          versionId: newVersion.id,
        })),
      );
    }

    return newVersion;
  };

  if (tx) {
    return await runInTransaction(tx);
  }

  return await db.transaction(async (newTx) => {
    return await runInTransaction(newTx);
  });
}
