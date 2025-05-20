import { and, db, eq, inArray } from "@weldr/db";

import type { CanvasNodeData, TStreamableValue } from "@/types";
import { createId } from "@paralleldrive/cuid2";
import {
  canvasNodes,
  declarationPackages,
  declarations,
  dependencies,
  packages,
  versionDeclarations,
  versionFiles,
  versions,
} from "@weldr/db/schema";
import { S3 } from "@weldr/shared/s3";
import type { z } from "zod";
import {
  type declarationSpecsWithDependenciesSchema,
  enricher,
} from "../enricher";

const getDeclarationName = (
  enrichedDeclaration: z.infer<typeof declarationSpecsWithDependenciesSchema>,
) => {
  switch (enrichedDeclaration.type) {
    case "component": {
      return enrichedDeclaration.definition.name;
    }
    case "function":
    case "model":
    case "other": {
      return enrichedDeclaration.name;
    }
    case "endpoint": {
      switch (enrichedDeclaration.definition.subtype) {
        case "rest": {
          return `${enrichedDeclaration.definition.method.toUpperCase()}:${enrichedDeclaration.definition.path}`;
        }
        case "rpc": {
          return `${enrichedDeclaration.definition.name}`;
        }
      }
    }
  }
};

export async function enrich({
  streamWriter,
  versionId,
  projectId,
  userId,
}: {
  streamWriter: WritableStreamDefaultWriter<TStreamableValue>;
  versionId: string;
  projectId: string;
  userId: string;
}) {
  await db.transaction(async (tx) => {
    const version = await tx.query.versions.findFirst({
      where: eq(versions.id, versionId),
      with: {
        declarations: {
          with: {
            declaration: {
              with: {
                file: true,
              },
            },
          },
        },
      },
    });

    if (!version) {
      throw new Error("Version not found");
    }

    const versionFilesList = await tx.query.versionFiles.findMany({
      where: eq(versionFiles.versionId, versionId),
      with: {
        file: true,
      },
    });

    const allFiles = versionFilesList.map((file) => file.file);
    const changedFiles = allFiles.filter((file) => {
      const normalizedPaths = version.changedFiles
        .filter((path) => path.endsWith(".tsx") || path.endsWith(".ts"))
        .map((path) => (path.startsWith("/") ? path : `/${path}`));
      return normalizedPaths.some((path) => file.path === path);
    });

    console.log(
      `[enrich:${projectId}] Found ${changedFiles.map((file) => file.path)} changed files`,
    );

    const previousVersion = await tx.query.versions.findFirst({
      where: and(
        eq(versions.projectId, projectId),
        eq(versions.number, version.number - 1),
      ),
    });

    const insertDeclarations: (typeof declarations.$inferSelect)[] = [];
    const allEnrichedDeclarations: z.infer<
      typeof declarationSpecsWithDependenciesSchema
    >[] = [];

    for (const file of changedFiles) {
      console.log(`[enrich:${projectId}] Processing file ${file.path}`);
      let previousContent: string | undefined;

      // If the previous version exists, read the previous content from the S3 version
      if (previousVersion) {
        const fileS3Version = await tx.query.versionFiles.findFirst({
          where: and(
            eq(versionFiles.versionId, previousVersion.id),
            eq(versionFiles.fileId, file.id),
          ),
        });

        if (fileS3Version) {
          previousContent = await S3.readFile({
            projectId,
            path: file.path,
            versionId: fileS3Version.s3VersionId,
          });
        }
      }

      // Read the current content from the S3 file
      const content = await S3.readFile({
        projectId,
        path: file.path,
      });

      if (!content) {
        throw new Error("File not found");
      }

      console.log(`[enrich:${projectId}] Processing file ${file.path}`);

      const {
        declarations: enrichedDeclarations,
        metadata: { deletedDeclarations, updatedDeclarations },
      } = await enricher({
        projectId: version.projectId,
        path: file.path,
        currentContent: content,
        previousContent,
      });

      allEnrichedDeclarations.push(...enrichedDeclarations);

      // Delete all declarations that are deleted or updated from the current version
      const deletedAndUpdatedDeclarations = [
        ...deletedDeclarations,
        ...updatedDeclarations,
      ];

      if (deletedAndUpdatedDeclarations.length > 0) {
        const versionDeletedAndUpdatedDeclarations =
          version.declarations.filter(
            (declaration) =>
              declaration.declaration.file.path === file.path &&
              deletedAndUpdatedDeclarations.includes(
                declaration.declaration.name,
              ),
          );

        // Delete the version declarations
        if (versionDeletedAndUpdatedDeclarations.length > 0) {
          await tx.delete(versionDeclarations).where(
            and(
              eq(versionDeclarations.versionId, versionId),
              inArray(
                versionDeclarations.declarationId,
                versionDeletedAndUpdatedDeclarations.map(
                  (declaration) => declaration.declaration.id,
                ),
              ),
            ),
          );
        }
      }

      console.log(
        `[enrich:${projectId}] Found ${enrichedDeclarations.length} enriched declarations`,
      );

      // Insert the new enriched declarations
      for (const enrichedDeclaration of enrichedDeclarations) {
        const declarationId = createId();

        const declarationName = getDeclarationName(enrichedDeclaration);

        const declarationCreatedAt = new Date();
        const declarationUpdatedAt = new Date();

        const previousDeclaration = version.declarations.find(
          (declaration) =>
            declaration.declaration.name === declarationName &&
            declaration.declaration.fileId === file.id,
        )?.declaration;

        let canvasNode: typeof canvasNodes.$inferSelect | undefined =
          previousDeclaration?.canvasNodeId
            ? await tx.query.canvasNodes.findFirst({
                where: eq(canvasNodes.id, previousDeclaration.canvasNodeId),
              })
            : undefined;

        if (enrichedDeclaration.isNode) {
          // Insert the canvas node if it doesn't exist
          if (!canvasNode) {
            const [insertedCanvasNode] = await tx
              .insert(canvasNodes)
              .values({
                type: "declaration",
                position: {
                  x: 0,
                  y: 0,
                },
                projectId,
              })
              .returning();

            if (!insertedCanvasNode) {
              throw new Error("Failed to insert canvas node");
            }

            canvasNode = insertedCanvasNode;
          }

          const newNode: CanvasNodeData = {
            id: declarationId,
            name: declarationName,
            type: enrichedDeclaration.type,
            specs: {
              version: "v1",
              data: enrichedDeclaration,
            },
            canvasNode: {
              id: canvasNode.id,
              type: "declaration",
              position: canvasNode.position,
              createdAt: canvasNode.createdAt,
              updatedAt: canvasNode.updatedAt,
              projectId,
            },
            createdAt: declarationCreatedAt,
            updatedAt: declarationUpdatedAt,
            projectId,
            userId,
            fileId: file.id,
            canvasNodeId: canvasNode.id,
            previousId: previousDeclaration?.id ?? null,
          };

          await streamWriter.write({
            type: "nodes",
            node: newNode,
          });
        }

        insertDeclarations.push({
          id: declarationId,
          fileId: file.id,
          name: declarationName,
          type: enrichedDeclaration.type,
          specs: {
            version: "v1",
            data: enrichedDeclaration,
          },
          projectId,
          userId,
          previousId: previousDeclaration?.id ?? null,
          canvasNodeId: canvasNode?.id ?? null,
          createdAt: declarationCreatedAt,
          updatedAt: declarationUpdatedAt,
        });
      }
    }

    if (insertDeclarations.length > 0) {
      await tx.insert(declarations).values(insertDeclarations);

      await tx.insert(versionDeclarations).values(
        insertDeclarations.map((declaration) => ({
          versionId,
          declarationId: declaration.id,
        })),
      );

      // Insert declaration dependencies
      for (const declaration of insertDeclarations) {
        const enrichedDeclaration = allEnrichedDeclarations.find(
          (enrichedDeclaration) => {
            const declarationName = getDeclarationName(enrichedDeclaration);
            return declarationName === declaration.name;
          },
        );

        if (!enrichedDeclaration) {
          throw new Error(`Declaration not found: ${declaration.name}`);
        }

        // Get the stored packages
        const storedPkgs = await tx.query.packages.findMany({
          where: and(
            inArray(
              packages.name,
              enrichedDeclaration.dependencies.external.map((pkg) => pkg.name),
            ),
            eq(packages.projectId, projectId),
          ),
        });

        if (enrichedDeclaration.dependencies.external.length > 0) {
          await tx.insert(declarationPackages).values(
            enrichedDeclaration.dependencies.external.map((pkg) => {
              const pkgId = storedPkgs.find(
                (storedPkg) => storedPkg.name === pkg.name,
              )?.id;

              if (!pkgId) {
                throw new Error(`Package not found: ${pkg.name}`);
              }

              return {
                declarationId: declaration.id,
                packageId: pkgId,
                importPath: pkg.name,
                declarations: pkg.dependsOn,
              };
            }),
          );
        }

        // Get all declarations after inserting the new declarations
        const versionNewDeclarations =
          await tx.query.versionDeclarations.findMany({
            where: eq(versionDeclarations.versionId, versionId),
            with: {
              declaration: {
                with: {
                  file: true,
                },
              },
            },
          });

        for (const dependency of enrichedDeclaration.dependencies.internal) {
          // Get the dependencies that match the dependency name and file path
          const tempDependencies = versionNewDeclarations.filter(
            (declaration) => {
              if (!dependency.importPath) {
                // TODO: Check if this is correct and actually works
                // Handle RPC and REST API cases
                if (
                  declaration.declaration.type === "endpoint" &&
                  declaration.declaration.specs
                ) {
                  const endpointSpecs = declaration.declaration.specs.data as {
                    definition: {
                      subtype: "rpc" | "rest";
                      name?: string;
                      method?: string;
                      path?: string;
                    };
                  };
                  if (endpointSpecs.definition.subtype === "rpc") {
                    // For RPC, match by name
                    return dependency.dependsOn.includes(
                      endpointSpecs.definition.name ?? "",
                    );
                  }
                  // For REST, match by HTTP method and path
                  const restName = `${endpointSpecs.definition.method?.toUpperCase()}:${endpointSpecs.definition.path}`;
                  return dependency.dependsOn.includes(restName);
                }
                return false;
              }

              const declarationNormalizedFilePath =
                declaration.declaration.file.path.startsWith("/")
                  ? declaration.declaration.file.path.replace(/\.[^/.]+$/, "")
                  : `/${declaration.declaration.file.path.replace(/\.[^/.]+$/, "")}`;

              const dependencyNormalizedFilePath =
                dependency.importPath.startsWith("/")
                  ? dependency.importPath.replace(/\.[^/.]+$/, "")
                  : `/${dependency.importPath.replace(/\.[^/.]+$/, "")}`;

              return (
                dependency.dependsOn.includes(declaration.declaration.name) &&
                (declarationNormalizedFilePath ===
                  dependencyNormalizedFilePath ||
                  declarationNormalizedFilePath ===
                    `${dependencyNormalizedFilePath}/index`)
              );
            },
          );

          if (tempDependencies.length > 0) {
            await tx.insert(dependencies).values(
              tempDependencies.map((dependency) => ({
                dependentType: declaration.type,
                dependentId: declaration.id,
                dependencyType: dependency.declaration.type,
                dependencyId: dependency.declaration.id,
              })),
            );
          }
        }
      }
    }

    await tx
      .update(versions)
      .set({
        progress: "enriched",
      })
      .where(eq(versions.id, versionId));
  });

  await streamWriter.write({
    type: "coder",
    status: "enriched",
  });
}
