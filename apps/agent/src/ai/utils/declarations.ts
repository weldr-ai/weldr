import { WORKSPACE_DIR } from "@/lib/constants";
import { Logger } from "@/lib/logger";
import type { WorkflowContext } from "@/workflow/context";
import { and, db, eq } from "@weldr/db";
import {
  chats,
  declarationIntegrations,
  declarations,
  dependencies,
  type integrationTemplates,
  integrations,
  nodes,
  versionDeclarations,
} from "@weldr/db/schema";
import { nanoid } from "@weldr/shared/nanoid";
import type { TaskDeclaration } from "@weldr/shared/types";
import type { DeclarationSpecs } from "@weldr/shared/types/declarations";
import { inArray } from "drizzle-orm";
import { getEnrichmentManager } from "../services/enrichment-manager";
import { extractDeclarations } from "./extract-declarations";

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

export const createDeclarations = async ({
  context,
  inputDeclarations,
}: {
  context: WorkflowContext;
  inputDeclarations: TaskDeclaration[];
}) => {
  const project = context.get("project");
  const version = context.get("version");
  const user = context.get("user");

  const logger = Logger.get({
    tags: ["createDeclarations"],
    extra: {
      projectId: project.id,
      versionId: version.id,
    },
  });

  await db.transaction(async (tx) => {
    const [createdDeclarationChat] = await tx
      .insert(chats)
      .values({
        userId: version.userId,
        projectId: project.id,
      })
      .returning();

    if (!createdDeclarationChat) {
      logger.error("Failed to create declaration chat");
      throw new Error(
        `[createTasks:project_${project.id}:version_${version.id}] Failed to create declaration chat`,
      );
    }

    // Create declarations
    const declarationIds = new Map<number, typeof declarations.$inferSelect>();
    const existingNodes = await tx.query.nodes.findMany({
      where: eq(nodes.projectId, project.id),
      with: {
        declaration: {
          columns: {
            specs: true,
          },
        },
      },
    });

    const allRects: Rect[] = existingNodes.map((node) => {
      const type =
        (node.declaration?.specs?.data?.type as keyof typeof NODE_DIMENSIONS) ??
        "default";
      const dimensions = NODE_DIMENSIONS[type] || NODE_DIMENSIONS.default;
      return {
        x: node.position.x,
        y: node.position.y,
        ...dimensions,
      };
    });

    const nextPos = { x: 0, y: 0 };

    for (const declaration of inputDeclarations) {
      const type =
        (declaration.data.type as keyof typeof NODE_DIMENSIONS) ?? "default";
      const dimensions = NODE_DIMENSIONS[type] || NODE_DIMENSIONS.default;

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

      const newPosition = { ...nextPos };
      allRects.push({ ...newPosition, ...dimensions });

      const [canvasNode] = await tx
        .insert(nodes)
        .values({
          projectId: project.id,
          position: newPosition,
        })
        .returning();

      if (!canvasNode) {
        logger.error("Failed to create canvas node");
        throw new Error(
          `[createTasks:project_${project.id}:version_${version.id}] Failed to create canvas node`,
        );
      }

      const [createdDeclaration] = await tx
        .insert(declarations)
        .values({
          progress: "pending",
          specs: declaration.data as unknown as DeclarationSpecs,
          implementationDetails: {
            summary: declaration.summary,
            acceptanceCriteria: declaration.acceptanceCriteria,
            description: declaration.description,
            implementationNotes: declaration.implementationNotes,
            subTasks: declaration.subTasks,
          },
          projectId: project.id,
          userId: user.id,
          nodeId: canvasNode.id,
          chatId: createdDeclarationChat.id,
        })
        .returning();

      if (!createdDeclaration) {
        logger.error("Failed to create declaration");
        throw new Error(
          `[createTasks:project_${project.id}:version_${version.id}] Failed to create declaration`,
        );
      }

      await tx.insert(versionDeclarations).values({
        versionId: version.id,
        declarationId: createdDeclaration.id,
      });

      // Stream node creation to client
      try {
        const streamWriter = global.sseConnections?.get(version.chatId);
        if (streamWriter && createdDeclaration.specs) {
          await streamWriter.write({
            type: "node",
            nodeId: canvasNode.id,
            position: canvasNode.position,
            specs: createdDeclaration.specs,
            progress: createdDeclaration.progress,
            node: canvasNode,
          });
        }
      } catch (error) {
        logger.warn("Failed to stream node creation", {
          extra: { error, nodeId: canvasNode.id },
        });
      }

      declarationIds.set(declaration.id, createdDeclaration);

      for (const declarationIntegration of declaration.integrations ?? []) {
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
            `[createTasks:project_${project.id}:version_${version.id}] Integration not found`,
          );
        }

        await tx.insert(declarationIntegrations).values({
          declarationId: createdDeclaration.id,
          integrationId: integration.id,
        });
      }
    }

    // Create declaration dependencies
    for (const declaration of inputDeclarations) {
      for (const dependency of declaration.dependencies ?? []) {
        const dependentId = declarationIds.get(declaration.id);
        const dependencyId = declarationIds.get(dependency);

        if (!dependentId || !dependencyId) {
          logger.error("Declaration ID not found for dependency mapping", {
            extra: {
              dependentInputId: declaration.id,
              dependencyInputId: dependency,
              foundDependent: !!dependentId,
              foundDependency: !!dependencyId,
            },
          });
          throw new Error(
            `[createTasks:project_${project.id}:version_${version.id}] Declaration ID not found for dependency mapping`,
          );
        }

        await tx.insert(dependencies).values({
          dependentId: dependentId.id,
          dependencyId: dependencyId.id,
        });
      }
    }
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
    tags: ["extractAndSaveDeclarations"],
    extra: {
      projectId: project.id,
      versionId: version.id,
    },
  });

  try {
    const pathAliases: Record<string, string> = {};
    if (project.config?.server && project.config?.client) {
      pathAliases["@/"] = "web/";
      pathAliases["@server/"] = "server/";
    } else if (project.config?.server || project.config?.client) {
      pathAliases["@/"] = "src/";
    }

    const extracted = await extractDeclarations({
      sourceCode: sourceCode,
      filename: filePath,
      projectRoot: WORKSPACE_DIR,
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
                },
              },
            },
          });

        const existingDeclarations = activeVersionDeclarations
          .filter((d) => d.declaration?.path?.includes(filePath))
          .map((d) => d.declaration);

        // Delete existing declarations for this file to create new ones
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

        // Map declaration URIs to declaration IDs
        const newDeclarationUriToId = new Map<string, string>();

        for (const data of extracted) {
          const declarationId = nanoid();
          newDeclarationUriToId.set(data.uri, declarationId);

          await tx.insert(declarations).values({
            id: declarationId,
            uri: data.uri,
            path: filePath,
            progress: "completed",
            data,
            projectId: project.id,
            userId: project.userId,
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

                // Select from new declarations
                let dependencyId = newDeclarationUriToId.get(dependencyUri);

                // Select from active version declarations if not found in new declarations
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

      // Queue semantic enrichment for the newly created declarations (non-blocking)
      try {
        const enrichmentManager = getEnrichmentManager();
        const declarationsForEnrichment = extracted.map((data) => ({
          id: newDeclarationUriToId.get(data.uri)!,
          data,
        })).filter(d => d.id); // Filter out any undefined IDs

        if (declarationsForEnrichment.length > 0) {
          await enrichmentManager.queueSemanticEnrichment({
            declarations: declarationsForEnrichment,
            context,
            filePath,
            sourceCode,
            priority: 0, // Normal priority for background enrichment
          });
        }
      } catch (enrichmentError) {
        // Log error but don't fail the main process
        logger.warn("Failed to queue semantic enrichment", {
          extra: {
            error: enrichmentError instanceof Error 
              ? enrichmentError.message 
              : enrichmentError,
          },
        });
      }
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

export async function getExecutionPlan({
  projectId,
  versionId,
}: {
  projectId: string;
  versionId: string;
}): Promise<Declaration[]> {
  const versionDeclarationIdsResult =
    await db.query.versionDeclarations.findMany({
      where: eq(versionDeclarations.versionId, versionId),
      columns: {
        declarationId: true,
      },
    });

  if (versionDeclarationIdsResult.length === 0) {
    return [];
  }

  const declarationIds = versionDeclarationIdsResult.map(
    (d) => d.declarationId,
  );

  const declarationList = await db.query.declarations.findMany({
    where: and(
      eq(declarations.projectId, projectId),
      eq(declarations.progress, "pending"),
      inArray(declarations.id, declarationIds),
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
