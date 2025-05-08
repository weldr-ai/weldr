import { and, db, eq, inArray } from "@weldr/db";

import type { CanvasNodeData, TStreamableValue } from "@/types";
import { createId } from "@paralleldrive/cuid2";
import {
  type DeclarationDependency,
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
import { enricher } from "../enricher";
import { processDeclarations } from "./process-declarations";

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
    let newAndUpdatedDeclarations: Record<string, DeclarationDependency[]> = {};

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

      // Process the declarations
      const processedDeclarations = await processDeclarations({
        fileContent: content,
        filePath: file.path,
        previousContent,
      });

      newAndUpdatedDeclarations = {
        ...newAndUpdatedDeclarations,
        ...processedDeclarations.newDeclarations,
        ...processedDeclarations.updatedDeclarations,
      };

      // Delete all deleted and updated declarations
      const deletedAndUpdatedDeclarations = [
        ...Object.keys(processedDeclarations.deletedDeclarations),
        ...Object.keys(processedDeclarations.updatedDeclarations),
      ];

      // Delete all deleted and updated declarations
      if (deletedAndUpdatedDeclarations.length > 0) {
        await tx.delete(versionDeclarations).where(
          and(
            eq(versionDeclarations.versionId, versionId),
            inArray(
              versionDeclarations.declarationId,
              version.declarations
                .filter(
                  (declaration) =>
                    declaration.declaration.fileId === file.id &&
                    deletedAndUpdatedDeclarations.includes(
                      declaration.declaration.name,
                    ),
                )
                .map((declaration) => declaration.declarationId),
            ),
          ),
        );
      }

      // Enrich the new and updated declarations
      console.log(
        `[enrich:${projectId}] Enriching declarations new: ${Object.keys(
          processedDeclarations.newDeclarations,
        ).join(", ")} updated: ${Object.keys(
          processedDeclarations.updatedDeclarations,
        ).join(", ")}`,
      );

      const enrichedDeclarations = await enricher({
        projectId: version.projectId,
        file: {
          path: file.path,
          content,
        },
        newDeclarations: processedDeclarations.newDeclarations,
        updatedDeclarations: version.declarations
          .filter(
            (declaration) =>
              Object.keys(processedDeclarations.updatedDeclarations).includes(
                declaration.declaration.name,
              ) && declaration.declaration.fileId === file.id,
          )
          .map((declaration) => declaration.declaration),
      });

      console.log(
        `[enrich:${projectId}] Found ${enrichedDeclarations.length} enriched declarations`,
      );

      for (const {
        version: specVersion,
        data,
        isNode,
      } of enrichedDeclarations) {
        const declarationId = createId();

        const declarationName = (() => {
          switch (data.type) {
            case "component": {
              return data.definition.name;
            }
            case "function":
            case "model":
            case "other": {
              return data.name;
            }
            case "endpoint": {
              switch (data.definition.subtype) {
                case "rest": {
                  return `${data.definition.method.toUpperCase()}:${data.definition.path}`;
                }
                case "rpc": {
                  return `${data.definition.name}`;
                }
              }
            }
          }
        })();

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

        if (isNode) {
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
            type: data.type,
            specs: {
              version: specVersion,
              data,
              isNode,
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
          type: data.type,
          specs: {
            version: specVersion,
            data,
            isNode,
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
        const declarationDependencies =
          newAndUpdatedDeclarations[declaration.name] ?? [];

        // Insert the external declaration packages
        const pkgs = declarationDependencies.filter(
          (dependency) => dependency.type === "external",
        );

        const savedPkgs = await tx.query.packages.findMany({
          where: and(
            inArray(
              packages.name,
              pkgs.map((pkg) => pkg.name),
            ),
            eq(packages.projectId, projectId),
          ),
        });

        if (pkgs.length > 0) {
          await tx.insert(declarationPackages).values(
            pkgs.map((pkg) => {
              const pkgId = savedPkgs.find(
                (savedPkg) => savedPkg.name === pkg.name,
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

        // Insert declaration dependencies
        const internalDependencies = declarationDependencies.filter(
          (dependency) => dependency.type === "internal",
        );

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

        for (const dependency of internalDependencies) {
          // Get the dependencies that match the dependency name and file path
          const tempDependencies = versionNewDeclarations.filter(
            (declaration) => {
              const declarationNormalizedFilePath =
                declaration.declaration.file.path.startsWith("/")
                  ? declaration.declaration.file.path.replace(/\.[^/.]+$/, "")
                  : `/${declaration.declaration.file.path.replace(/\.[^/.]+$/, "")}`;

              const dependencyNormalizedFilePath = dependency.from.startsWith(
                "/",
              )
                ? dependency.from.replace(/\.[^/.]+$/, "")
                : `/${dependency.from.replace(/\.[^/.]+$/, "")}`;

              return (
                dependency.dependsOn.includes(declaration.declaration.name) &&
                declarationNormalizedFilePath === dependencyNormalizedFilePath
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
