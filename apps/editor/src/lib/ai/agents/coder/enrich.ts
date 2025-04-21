import { and, db, eq, inArray } from "@weldr/db";

import type { CanvasNodeData, TStreamableValue } from "@/types";
import { createId } from "@paralleldrive/cuid2";
import {
  canvasNodes,
  chats,
  declarationPackages,
  declarations,
  dependencies,
  files,
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
  paths,
}: {
  streamWriter: WritableStreamDefaultWriter<TStreamableValue>;
  versionId: string;
  projectId: string;
  userId: string;
  paths: string[];
}) {
  await db.transaction(async (tx) => {
    const version = await tx.query.versions.findFirst({
      where: eq(versions.id, versionId),
      with: {
        declarations: {
          with: {
            declaration: true,
          },
        },
      },
    });

    if (!version) {
      throw new Error("Version not found");
    }

    const filesResult = await tx.query.files.findMany({
      where: inArray(files.path, paths),
    });

    const previousVersion = await tx.query.versions.findFirst({
      where: and(
        eq(versions.projectId, projectId),
        eq(versions.number, version.number - 1),
      ),
    });

    for (const file of filesResult) {
      let previousContent: string | undefined;

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

      const content = await S3.readFile({
        projectId,
        path: file.path,
      });

      if (!content) {
        throw new Error("File not found");
      }

      const processedDeclarations = await processDeclarations({
        fileContent: content,
        filePath: file.path,
        previousContent,
      });

      // Delete all deleted and updated declarations
      const deletedAndUpdatedDeclarations = [
        ...Object.keys(processedDeclarations.deletedDeclarations),
        ...Object.keys(processedDeclarations.updatedDeclarations),
      ];

      if (deletedAndUpdatedDeclarations.length > 0) {
        await tx.delete(versionDeclarations).where(
          and(
            eq(versionDeclarations.versionId, versionId),
            inArray(
              versionDeclarations.declarationId,
              version.declarations
                .filter(
                  (v) =>
                    v.declaration.fileId === file.id &&
                    deletedAndUpdatedDeclarations.includes(v.declaration.name),
                )
                .map((v) => v.declarationId),
            ),
          ),
        );
      }

      // Enrich the new and updated declarations
      const enrichedDeclarations = await enricher({
        file: {
          path: file.path,
          content,
        },
        newDeclarations: processedDeclarations.newDeclarations,
        updatedDeclarations: version.declarations
          .filter(
            (v) =>
              Object.keys(processedDeclarations.updatedDeclarations).includes(
                v.declaration.name,
              ) && v.declaration.fileId === file.id,
          )
          .map((v) => v.declaration),
      });

      const insertDeclarations: (typeof declarations.$inferSelect)[] = [];

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
          (d) =>
            d.declaration.name === declarationName &&
            d.declaration.fileId === file.id,
        )?.declaration;

        let canvasNode: typeof canvasNodes.$inferSelect | undefined =
          previousDeclaration?.canvasNodeId
            ? await tx.query.canvasNodes.findFirst({
                where: eq(canvasNodes.id, previousDeclaration.canvasNodeId),
              })
            : undefined;

        let chat = canvasNode?.id
          ? await tx.query.chats.findFirst({
              where: eq(chats.canvasNodeId, canvasNode.id),
              with: {
                messages: {
                  columns: {
                    content: false,
                  },
                  orderBy: (messages, { asc }) => [asc(messages.createdAt)],
                  with: {
                    attachments: {
                      columns: {
                        name: true,
                        key: true,
                      },
                    },
                    user: {
                      columns: {
                        name: true,
                      },
                    },
                  },
                },
              },
              orderBy: (chats, { asc }) => [asc(chats.createdAt)],
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
              })
              .returning();

            if (!insertedCanvasNode) {
              throw new Error("Failed to insert canvas node");
            }

            canvasNode = insertedCanvasNode;
          }

          if (!chat) {
            const [insertedChat] = await tx
              .insert(chats)
              .values({
                userId,
                canvasNodeId: canvasNode.id,
              })
              .returning();

            if (!insertedChat) {
              throw new Error("Failed to insert chat");
            }

            chat = {
              ...insertedChat,
              messages: [],
            };
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

      if (insertDeclarations.length > 0) {
        await tx.insert(declarations).values(insertDeclarations);

        await tx.insert(versionDeclarations).values(
          insertDeclarations.map((d) => ({
            versionId,
            declarationId: d.id,
          })),
        );

        const newAndUpdatedDeclarations = {
          ...processedDeclarations.newDeclarations,
          ...processedDeclarations.updatedDeclarations,
        };

        // Insert declaration dependencies
        for (const declaration of insertDeclarations) {
          const declarationDependencies =
            newAndUpdatedDeclarations[declaration.name] ?? [];

          // Insert the declaration packages
          const pkgs = declarationDependencies.filter(
            (d) => d.type === "external",
          );

          const savedPkgs = await tx.query.packages.findMany({
            where: and(
              inArray(
                packages.name,
                pkgs.map((p) => p.name),
              ),
              eq(packages.projectId, projectId),
            ),
          });

          if (pkgs.length > 0) {
            await tx.insert(declarationPackages).values(
              pkgs.map((pkg) => {
                const pkgId = savedPkgs.find((p) => p.name === pkg.name)?.id;

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
            (d) => d.type === "internal",
          );

          for (const dependency of internalDependencies) {
            const tempDependencies = version.declarations.filter(
              (d) =>
                dependency.dependsOn.includes(d.declaration.name) &&
                d.declaration.fileId === file.id,
            );

            if (tempDependencies.length > 0) {
              await tx.insert(dependencies).values(
                tempDependencies.map((d) => ({
                  dependentType: declaration.type,
                  dependentId: declaration.id,
                  dependencyType: d.declaration.type,
                  dependencyId: d.declaration.id,
                })),
              );
            }
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
