import { Logger } from "@/lib/logger";
import type { WorkflowContext } from "@/workflow/context";
import { and, db, eq } from "@weldr/db";
import {
  chats,
  declarationIntegrations,
  declarations,
  dependencies,
  integrations,
  nodes,
} from "@weldr/db/schema";
import type { TaskDeclaration } from "@weldr/shared/types";
import type { DeclarationSpecs } from "@weldr/shared/types/declarations";

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
