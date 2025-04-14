import type { CanvasNodeData, TStreamableValue } from "@/types";
import { createId } from "@paralleldrive/cuid2";
import type { InferInsertModel, InferSelectModel, Tx } from "@weldr/db";
import { and, eq, inArray } from "@weldr/db";
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
} from "@weldr/db/schema";
import { S3 } from "@weldr/shared/s3";
import { annotator } from "../annotator";
import type { FileCache } from "./file-cache";
import { processDeclarations } from "./process-declarations";

export async function processFile({
  content,
  path,
  projectId,
  versionId,
  userId,
  tx,
  previousVersionId,
  deletedDeclarations,
  fileCache,
  streamWriter,
}: {
  content: string;
  path: string;
  projectId: string;
  versionId: string;
  userId: string;
  tx: Tx;
  previousVersionId?: string;
  deletedDeclarations: string[];
  fileCache: FileCache;
  streamWriter: WritableStreamDefaultWriter<TStreamableValue>;
}) {
  let file = await tx.query.files.findFirst({
    where: and(eq(files.projectId, projectId), eq(files.path, path)),
  });

  let previousContent: string | undefined = undefined;

  if (!file) {
    const [insertedFile] = await tx
      .insert(files)
      .values({
        projectId,
        path,
        userId,
      })
      .onConflictDoNothing()
      .returning();

    file = insertedFile;
  } else {
    previousContent = await fileCache.getFile({
      projectId,
      path,
    });
  }

  if (!file) {
    throw new Error(
      `[processFile:${projectId}] Failed to insert/select file ${path}`,
    );
  }

  // Save the file to S3
  const s3Version = await S3.writeFile({
    projectId,
    path: file.path,
    content,
  });

  if (!s3Version) {
    throw new Error(
      `[processFile:${projectId}] Failed to write file ${file.path}`,
    );
  }

  // Cache the new content
  fileCache.setFile({
    projectId,
    path: file.path,
    content,
  });

  // Add the file to the version
  await tx.insert(versionFiles).values({
    versionId,
    fileId: file.id,
    s3VersionId: s3Version,
  });

  const processedDeclarations = await processDeclarations({
    fileContent: content,
    filePath: path,
    previousContent,
  });

  let previousVersionDeclarations: InferSelectModel<typeof declarations>[] = [];
  let declarationsToDelete: InferSelectModel<typeof declarations>[] = [];

  if (previousVersionId) {
    const versionDeclarationsResult =
      await tx.query.versionDeclarations.findMany({
        where: eq(versionDeclarations.versionId, previousVersionId),
        with: {
          declaration: {
            with: {
              canvasNode: true,
            },
          },
        },
      });

    previousVersionDeclarations = versionDeclarationsResult.map(
      (v) => v.declaration,
    );

    declarationsToDelete = previousVersionDeclarations.filter((d) =>
      Object.keys(processedDeclarations.deletedDeclarations).includes(d.name),
    );
  }

  const declarationInsertions: InferInsertModel<typeof declarations>[] = [];

  // Annotate the new declarations
  console.log(
    `[processFile:${projectId}] Creating ${Object.keys(processedDeclarations.newDeclarations).length} new annotations and updating ${Object.keys(processedDeclarations.updatedDeclarations).length} annotations`,
  );
  const annotations = await annotator({
    projectId,
    file: {
      path,
      content,
    },
    newDeclarations: processedDeclarations.newDeclarations,
    previousVersionDeclarations,
  });

  for (const { specs, isNode } of annotations) {
    const declarationId = createId();

    const declarationName = (() => {
      switch (specs.type) {
        case "component": {
          return specs.definition.name;
        }
        case "function":
        case "model":
        case "other": {
          return specs.name;
        }
        case "endpoint": {
          switch (specs.definition.subtype) {
            case "rest": {
              return `${specs.definition.method.toUpperCase()}:${specs.definition.path}`;
            }
            case "rpc": {
              return `${specs.definition.name}`;
            }
          }
        }
      }
    })();

    const declarationCreatedAt = new Date();
    const declarationUpdatedAt = new Date();

    const previousDeclaration = previousVersionDeclarations.find(
      (d) => d.name === declarationName,
    );

    let canvasNode: InferSelectModel<typeof canvasNodes> | undefined =
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
        type: specs.type,
        specs: {
          version: "v1",
          ...specs,
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

    declarationInsertions.push({
      id: declarationId,
      fileId: file.id,
      name: declarationName,
      type: specs.type,
      specs: {
        version: "v1",
        ...specs,
      },
      projectId,
      userId,
      previousId: previousDeclaration?.id,
      canvasNodeId: canvasNode?.id,
      createdAt: declarationCreatedAt,
      updatedAt: declarationUpdatedAt,
    });
  }

  let insertedDeclarations: InferSelectModel<typeof declarations>[] = [];

  if (declarationInsertions.length > 0) {
    insertedDeclarations = await tx
      .insert(declarations)
      .values(declarationInsertions)
      .onConflictDoNothing()
      .returning();

    // Insert version declarations
    if (insertedDeclarations.length > 0) {
      await tx.insert(versionDeclarations).values(
        insertedDeclarations.map((d) => ({
          versionId,
          declarationId: d.id,
        })),
      );
    }
  }

  const tempDeclarations = {
    ...processedDeclarations.newDeclarations,
    ...processedDeclarations.updatedDeclarations,
  };

  // Insert declaration dependencies
  for (const declaration of insertedDeclarations) {
    const declarationDependencies = tempDeclarations[declaration.name] ?? [];

    // Insert the declaration packages
    const pkgs = declarationDependencies.filter((d) => d.type === "external");

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
      const tempDependencies = previousVersionDeclarations.filter((d) =>
        dependency.dependsOn.includes(d.name),
      );

      if (tempDependencies.length > 0) {
        await tx.insert(dependencies).values(
          tempDependencies.map((d) => ({
            dependentType: declaration.type,
            dependentId: declaration.id,
            dependencyType: d.type,
            dependencyId: d.id,
          })),
        );
      }
    }
  }

  deletedDeclarations.push(...declarationsToDelete.map((d) => d.id));
}
