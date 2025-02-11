import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { TRPCError } from "@trpc/server";
import {
  type Db,
  type InferSelectModel,
  type Tx,
  and,
  db,
  eq,
  inArray,
} from "@weldr/db";
import {
  dependencies,
  endpointDefinitions,
  type endpoints,
  funcDefinitions,
  type funcs,
  versionEndpointDefinitions,
  versionFuncDefinitions,
  versionPackages,
  versions,
} from "@weldr/db/schema";
import { Fly } from "@weldr/shared/fly";
import { toKebabCase } from "@weldr/shared/utils";

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
      where: eq(dependencies.dependentDefinitionId, currentId),
      with: {
        dependencyFuncDefinition: true,
        dependencyEndpointDefinition: true,
      },
    });

    const depIds = deps.map((dep) => {
      if (dep.dependencyFuncDefinition) {
        return dep.dependencyFuncDefinition.funcId;
      }
      return dep.dependencyEndpointDefinition.endpointId;
    });

    for (const id of depIds) {
      const nextId = id;

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
  if (!func.currentDefinitionId) {
    return false;
  }
  return true;
}

export async function isEndpointReady(
  endpoint: InferSelectModel<typeof endpoints>,
): Promise<boolean> {
  if (!endpoint.currentDefinitionId) {
    return false;
  }
  return true;
}

export async function createVersion({
  db: transactionDb = db,
  versionName,
  projectId,
  userId,
  messageId,
}: {
  db?: Db | Tx;
  versionName: string;
  projectId: string;
  userId: string;
  messageId?: string;
}) {
  // Get current version with functions and their packages
  const currentVersion = await transactionDb.query.versions.findFirst({
    where: and(eq(versions.projectId, projectId), eq(versions.isActive, true)),
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
      projectId,
      isActive: true,
      versionName,
      versionNumber: nextVersionNumber,
      userId,
      parentVersionId: currentVersion.id,
      messageId,
    })
    .returning()
    .then(([version]) => version);

  if (!newVersion) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to create new version",
    });
  }

  return {
    previousVersion: currentVersion,
    newVersion,
  };
}

export async function defineVersion({
  db: transactionDb = db,
  previousVersionId,
  newVersionId,
  addedFuncDefinitionIds,
  deletedFuncDefinitionIds,
  addedEndpointDefinitionIds,
  deletedEndpointDefinitionIds,
}: {
  db: Db | Tx;
  previousVersionId: string;
  newVersionId: string;
  addedFuncDefinitionIds?: string[];
  deletedFuncDefinitionIds?: string[];
  addedEndpointDefinitionIds?: string[];
  deletedEndpointDefinitionIds?: string[];
}) {
  const previousVersion = await transactionDb.query.versions.findFirst({
    where: eq(versions.id, previousVersionId),
    with: {
      funcDefinitions: {
        with: {
          funcDefinition: true,
        },
      },
      endpointDefinitions: {
        with: {
          endpointDefinition: true,
        },
      },
    },
  });

  if (!previousVersion) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to find previous version",
    });
  }

  const versionFuncDefinitionIdsSet = new Set<string>([
    ...(addedFuncDefinitionIds ?? []),
  ]);
  const versionEndpointDefinitionIdsSet = new Set<string>([
    ...(addedEndpointDefinitionIds ?? []),
  ]);

  // Collect functions that will be in the new version
  for (const funcDefinitionId of previousVersion.funcDefinitions) {
    if (
      !deletedFuncDefinitionIds?.includes(funcDefinitionId.funcDefinitionId)
    ) {
      versionFuncDefinitionIdsSet.add(funcDefinitionId.funcDefinitionId);
    }
  }

  // Collect endpoints that will be in the new version
  for (const endpointDefinitionId of previousVersion.endpointDefinitions) {
    if (
      !deletedEndpointDefinitionIds?.includes(
        endpointDefinitionId.endpointDefinitionId,
      )
    ) {
      versionEndpointDefinitionIdsSet.add(
        endpointDefinitionId.endpointDefinitionId,
      );
    }
  }

  const versionFuncDefinitionIds = Array.from(versionFuncDefinitionIdsSet);
  const versionEndpointDefinitionIds = Array.from(
    versionEndpointDefinitionIdsSet,
  );

  // Insert functions for the new version
  if (versionFuncDefinitionIds.length > 0) {
    await transactionDb.insert(versionFuncDefinitions).values(
      versionFuncDefinitionIds.map((funcDefinitionId) => ({
        funcDefinitionId,
        versionId: newVersionId,
      })),
    );
  }

  // Insert endpoints for the new version
  if (versionEndpointDefinitionIds.length > 0) {
    await transactionDb.insert(versionEndpointDefinitions).values(
      versionEndpointDefinitionIds.map((endpointDefinitionId) => ({
        endpointDefinitionId,
        versionId: newVersionId,
      })),
    );
  }

  // Get all packages used by functions in the new version
  const newVersionFuncs = await transactionDb.query.funcDefinitions.findMany({
    where: inArray(funcDefinitions.id, versionFuncDefinitionIds),
    with: {
      packages: {
        with: {
          package: true,
        },
      },
    },
  });

  // Get all packages used by endpoints in the new version
  const newVersionEndpoints =
    await transactionDb.query.endpointDefinitions.findMany({
      where: inArray(endpointDefinitions.id, versionEndpointDefinitionIds),
      with: {
        packages: {
          with: {
            package: true,
          },
        },
      },
    });

  // Collect all unique package IDs that are in use
  const activePackages = new Map<
    string,
    {
      type: "production" | "development";
      name: string;
    }
  >();

  // Add packages from functions
  for (const func of newVersionFuncs) {
    for (const pkg of func.packages) {
      activePackages.set(pkg.packageId, {
        type: pkg.package.type,
        name: pkg.package.name,
      });
    }
  }

  // Add packages from endpoints
  for (const endpoint of newVersionEndpoints) {
    for (const pkg of endpoint.packages) {
      activePackages.set(pkg.packageId, {
        type: pkg.package.type,
        name: pkg.package.name,
      });
    }
  }

  // Insert active packages into version_packages
  if (activePackages.size > 0) {
    await transactionDb.insert(versionPackages).values(
      Array.from(activePackages).map(([packageId, _]) => ({
        packageId,
        versionId: newVersionId,
      })),
    );
  }

  // Deploy a machine for the new version only if there are endpoints
  if (process.env.NODE_ENV !== "development") {
    const files = [
      ...newVersionFuncs.map((func) => ({
        guest_path: `/src/lib/${toKebabCase(func.name)}.ts`,
        raw_value: Buffer.from(func.code).toString("base64"),
      })),
      ...newVersionEndpoints.map((endpoint) => {
        const normalizedPath = endpoint.path
          .replace(/^\//, "")
          .replace(/[{]/g, "[")
          .replace(/[}]/g, "]");
        return {
          guest_path: `/src/app/api/_hono/routes/${normalizedPath}/${endpoint.method}.ts`,
          raw_value: Buffer.from(endpoint.code).toString("base64"),
        };
      }),
    ];

    const machineId = await Fly.Machine.create({
      projectId: previousVersion.projectId,
      versionId: newVersionId,
      files,
      packages: {
        production: Array.from(activePackages.entries())
          .filter(([_, pkg]) => pkg.type === "production")
          .map(([_, pkg]) => pkg.name),
        development: Array.from(activePackages.entries())
          .filter(([_, pkg]) => pkg.type === "development")
          .map(([_, pkg]) => pkg.name),
      },
    });

    await transactionDb
      .update(versions)
      .set({
        machineId,
      })
      .where(eq(versions.id, newVersionId));
  }
}

export async function getDependencyChain(db: Db, primitiveIds: string[]) {
  const definitionDependencies = await db.query.dependencies.findMany({
    where: and(
      inArray(dependencies.dependentDefinitionId, primitiveIds),
      inArray(dependencies.dependencyDefinitionId, primitiveIds),
    ),
    with: {
      dependentFuncDefinition: {
        columns: {
          funcId: true,
        },
      },
      dependencyFuncDefinition: {
        columns: {
          funcId: true,
        },
      },
      dependentEndpointDefinition: {
        columns: {
          endpointId: true,
        },
      },
      dependencyEndpointDefinition: {
        columns: {
          endpointId: true,
        },
      },
    },
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

  for (const d of definitionDependencies) {
    if (d.dependentFuncDefinition && d.dependencyFuncDefinition) {
      const id = `${d.dependentFuncDefinition.funcId}-${d.dependencyFuncDefinition.funcId}`;
      dependencyChain.set(id, {
        id,
        type: "smooth",
        source: d.dependentFuncDefinition.funcId,
        target: d.dependencyFuncDefinition.funcId,
      });
    }

    if (d.dependentEndpointDefinition && d.dependencyFuncDefinition) {
      const id = `${d.dependentEndpointDefinition.endpointId}-${d.dependencyFuncDefinition.funcId}`;
      dependencyChain.set(id, {
        id,
        type: "smooth",
        source: d.dependentEndpointDefinition.endpointId,
        target: d.dependencyFuncDefinition.funcId,
      });
    }
  }

  return Array.from(dependencyChain.values());
}

const BUCKET_NAME = "weldr-chat-attachments";

const s3Client = new S3Client({
  // biome-ignore lint/style/noNonNullAssertion: <explanation>
  region: process.env.AWS_REGION!,
  // biome-ignore lint/style/noNonNullAssertion: <explanation>
  endpoint: process.env.AWS_ENDPOINT_URL_S3!,
  credentials: {
    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function getAttachmentUrl(key: string) {
  const url = await getSignedUrl(
    s3Client,
    new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    }),
    { expiresIn: 3600 },
  );

  return url;
}
