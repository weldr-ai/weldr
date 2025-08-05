import { inArray } from "drizzle-orm";
import { getSSEConnection } from "@/lib/utils";
import type { WorkflowContext } from "@/workflow/context";

import { and, db, eq } from "@weldr/db";
import {
  declarationIntegrations,
  declarations,
  dependencies,
  integrations,
  nodes,
  type tasks,
  versionDeclarations,
} from "@weldr/db/schema";
import { mergeJson } from "@weldr/db/utils";
import { Logger } from "@weldr/shared/logger";
import { nanoid } from "@weldr/shared/nanoid";
import { extractDeclarations } from "./extract-declarations";
import { queueDeclarationSemanticDataGeneration } from "./semantic-data-jobs";

const NODE_DIMENSIONS = {
  page: { width: 400, height: 300 },
  endpoint: { width: 256, height: 128 },
  "db-model": { width: 300, height: 250 },
  default: { width: 300, height: 200 },
};

const PLACEMENT_CONFIG = {
  gap: 50,
  maxCanvasWidth: 2000,
  xStep: 150,
  yStep: 150,
};

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const intersects = (a: Rect, b: Rect): boolean => {
  return (
    a.x < b.x + b.width + PLACEMENT_CONFIG.gap &&
    a.x + a.width + PLACEMENT_CONFIG.gap > b.x &&
    a.y < b.y + b.height + PLACEMENT_CONFIG.gap &&
    a.y + a.height + PLACEMENT_CONFIG.gap > b.y
  );
};

export const createDeclarationFromTask = async ({
  context,
  task,
}: {
  context: WorkflowContext;
  task: typeof tasks.$inferSelect;
}) => {
  const project = context.get("project");
  const version = context.get("version");
  const user = context.get("user");

  const logger = Logger.get({
    projectId: project.id,
    versionId: version.id,
  });

  const taskData = task.data;

  if (taskData.type !== "declaration") {
    return null;
  }

  return await db.transaction(async (tx) => {
    let node: typeof nodes.$inferSelect | undefined;
    let previousDeclarationId: string | null = null;

    if (taskData.operation === "create") {
      const existingNodes = await tx.query.nodes.findMany({
        where: eq(nodes.projectId, project.id),
        with: {
          declaration: {
            columns: {
              metadata: true,
            },
          },
        },
      });

      const allRects: Rect[] = existingNodes.map((node) => {
        const type =
          (node.declaration?.metadata?.codeMetadata
            ?.type as keyof typeof NODE_DIMENSIONS) ?? "default";
        const dimensions = NODE_DIMENSIONS[type] || NODE_DIMENSIONS.default;
        return {
          x: node.position.x,
          y: node.position.y,
          ...dimensions,
        };
      });

      const type =
        (taskData.specs.type as keyof typeof NODE_DIMENSIONS) ?? "default";
      const dimensions = NODE_DIMENSIONS[type] || NODE_DIMENSIONS.default;

      const nextPos = { x: 0, y: 0 };
      let hasCollision = true;
      while (hasCollision) {
        const candidateRect: Rect = { ...nextPos, ...dimensions };
        hasCollision = allRects.some((rect) => intersects(candidateRect, rect));

        if (hasCollision) {
          nextPos.x += PLACEMENT_CONFIG.xStep;
          if (nextPos.x > PLACEMENT_CONFIG.maxCanvasWidth) {
            nextPos.x = 0;
            nextPos.y += PLACEMENT_CONFIG.yStep;
          }
        }
      }

      const [createdCanvasNode] = await tx
        .insert(nodes)
        .values({
          projectId: project.id,
          position: nextPos,
        })
        .returning();

      if (!createdCanvasNode) {
        logger.error("Failed to create canvas node");
        throw new Error(
          `[createDeclarationFromTask:project_${project.id}:version_${version.id}] Failed to create canvas node`,
        );
      }

      node = createdCanvasNode;
    }

    if (taskData.operation === "update") {
      const existingVersionDeclarations =
        await tx.query.versionDeclarations.findMany({
          where: eq(versionDeclarations.versionId, version.id),
          with: {
            declaration: {
              columns: {
                id: true,
                uri: true,
                nodeId: true,
              },
            },
          },
        });

      const existingDeclaration = existingVersionDeclarations
        .map((d) => d.declaration)
        .find((d) => d?.uri === taskData.uri);

      if (!existingDeclaration) {
        logger.error("Declaration not found");
        throw new Error(
          `[createDeclarationFromTask:project_${project.id}:version_${version.id}] Declaration URI ${taskData.uri} not found, please make sure the declaration exists.`,
        );
      }

      if (!existingDeclaration.nodeId) {
        logger.error("Node ID not found");
        throw new Error(
          `[createDeclarationFromTask:project_${project.id}:version_${version.id}] Node ID not found, please make sure the node exists.`,
        );
      }

      await tx
        .delete(versionDeclarations)
        .where(eq(versionDeclarations.declarationId, existingDeclaration.id));

      node = await tx.query.nodes.findFirst({
        where: eq(nodes.id, existingDeclaration.nodeId),
      });

      previousDeclarationId = existingDeclaration.id;
    }

    const [createdDeclaration] = await tx
      .insert(declarations)
      .values({
        progress: "pending",
        path: taskData.filePath,
        metadata: {
          version: "v1",
          specs: taskData.specs,
        },
        previousId: previousDeclarationId,
        projectId: project.id,
        userId: user.id,
        nodeId: node?.id,
        taskId: task.id,
      })
      .returning();

    if (!createdDeclaration) {
      logger.error("Failed to create declaration");
      throw new Error(
        `[createDeclarationFromTask:project_${project.id}:version_${version.id}] Failed to create declaration`,
      );
    }

    await tx.insert(versionDeclarations).values({
      versionId: version.id,
      declarationId: createdDeclaration.id,
    });

    for (const declarationIntegration of taskData.integrations ?? []) {
      const integration = await tx.query.integrations.findFirst({
        where: and(
          eq(integrations.id, declarationIntegration),
          eq(integrations.projectId, project.id),
          eq(integrations.userId, user.id),
        ),
      });

      if (!integration) {
        logger.error("Integration not found");
        throw new Error(
          `[createDeclarationFromTask:project_${project.id}:version_${version.id}] Integration not found`,
        );
      }

      await tx.insert(declarationIntegrations).values({
        declarationId: createdDeclaration.id,
        integrationId: integration.id,
      });
    }

    try {
      const streamWriter = getSSEConnection(version.chatId);
      if (createdDeclaration.metadata?.specs && node) {
        await streamWriter.write({
          type: "node",
          nodeId: node.id,
          position: node.position,
          metadata: createdDeclaration.metadata,
          progress: createdDeclaration.progress,
          node: node,
        });
      }
    } catch (error) {
      logger.warn("Failed to stream node creation", {
        extra: { error, nodeId: node?.id },
      });
    }

    const declarationWithRelations = await tx.query.declarations.findFirst({
      where: eq(declarations.id, createdDeclaration.id),
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

    if (!declarationWithRelations) {
      throw new Error("Failed to fetch created declaration with relations");
    }

    return declarationWithRelations;
  });
};

export async function extractAndSaveDeclarations({
  context,
  filePath,
  sourceCode,
}: {
  context: WorkflowContext;
  filePath: string;
  sourceCode: string;
}): Promise<void> {
  const project = context.get("project");
  const version = context.get("version");

  const logger = Logger.get({
    projectId: project.id,
    versionId: version.id,
  });

  try {
    const pathAliases: Record<string, string> = {};

    if (
      project.integrationCategories.has("frontend") &&
      project.integrationCategories.has("backend")
    ) {
      pathAliases["@repo/web/*"] = "./src/*";
      pathAliases["@repo/server/*"] = "../server/src/*";
    } else if (project.integrationCategories.has("backend")) {
      pathAliases["@repo/server/*"] = "./src/*";
    } else if (project.integrationCategories.has("frontend")) {
      pathAliases["@repo/web/*"] = "./src/*";
    }

    const extracted = await extractDeclarations({
      sourceCode: sourceCode,
      filename: filePath,
      pathAliases,
    });

    logger.info(`Extracted ${extracted.length} declarations.`);

    if (extracted.length > 0) {
      await db.transaction(async (tx) => {
        const activeVersionDeclarations =
          await tx.query.versionDeclarations.findMany({
            where: and(eq(versionDeclarations.versionId, version.id)),
            with: {
              declaration: {
                columns: {
                  id: true,
                  path: true,
                  uri: true,
                  progress: true,
                },
              },
            },
          });

        const existingDeclarations = activeVersionDeclarations
          .filter((d) => d.declaration?.progress === "completed")
          .map((d) => d.declaration);

        if (existingDeclarations.length > 0) {
          const idsToDelete = existingDeclarations.map((d) => d.id);
          await tx
            .delete(versionDeclarations)
            .where(
              and(
                inArray(versionDeclarations.declarationId, idsToDelete),
                eq(versionDeclarations.versionId, version.id),
              ),
            );
        }

        const newDeclarationUriToId = new Map<string, string>();

        for (const data of extracted) {
          const declarationId = nanoid();
          newDeclarationUriToId.set(data.uri, declarationId);

          const doesDeclarationExist = existingDeclarations.find(
            (d) => d.path === filePath,
          );

          if (doesDeclarationExist) {
            await tx
              .update(declarations)
              .set({
                metadata: mergeJson(declarations.metadata, {
                  codeMetadata: data,
                }),
                progress: "enriching",
              })
              .where(eq(declarations.id, doesDeclarationExist.id))
              .returning();
          } else {
            await tx.insert(declarations).values({
              id: declarationId,
              uri: data.uri,
              path: filePath,
              progress: "enriching",
              metadata: {
                version: "v1",
                codeMetadata: data,
              },
              projectId: project.id,
              userId: project.userId,
            });
          }

          await queueDeclarationSemanticDataGeneration({
            declarationId,
            codeMetadata: data,
            filePath,
            sourceCode,
            projectId: project.id,
          });

          await tx.insert(versionDeclarations).values({
            versionId: version.id,
            declarationId,
          });
        }

        for (const data of extracted) {
          const dependentUri = data.uri;
          const dependentId = newDeclarationUriToId.get(dependentUri);
          if (!dependentId) continue;

          for (const dep of data.dependencies) {
            if (dep.type === "internal") {
              for (const depName of dep.dependsOn) {
                const dependencyUri = `${project.id}:${dep.filePath}:${depName}`;

                let dependencyId = newDeclarationUriToId.get(dependencyUri);

                if (!dependencyId) {
                  dependencyId = activeVersionDeclarations.find(
                    (d) => d.declaration?.uri === dependencyUri,
                  )?.declaration?.id;
                }

                if (dependencyId) {
                  await tx
                    .insert(dependencies)
                    .values({
                      dependentId,
                      dependencyId,
                    })
                    .onConflictDoNothing();
                } else {
                  logger.warn(
                    `Could not find dependency for URI: ${dependencyUri}`,
                    { extra: { dependentUri } },
                  );
                }
              }
            }
          }
        }
      });
      logger.info(
        `Successfully inserted ${extracted.length} declarations and linked to version.`,
      );
    }
  } catch (error) {
    logger.error("Failed to extract or save declarations", {
      extra: {
        error:
          error instanceof Error
            ? { message: error.message, stack: error.stack }
            : error,
      },
    });
  }
}
