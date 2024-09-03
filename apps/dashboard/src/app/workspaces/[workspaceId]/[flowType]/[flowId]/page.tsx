import type { Primitive } from "@integramind/shared/types";
import { notFound } from "next/navigation";

import { FlowBuilder } from "~/components/flow-builder";
import { api } from "~/lib/trpc/rsc";
import type { FlowEdge, FlowNode } from "~/types";

export default async function WorkflowPage({
  params,
}: {
  params: { flowType: string; flowId: string };
}): Promise<JSX.Element> {
  try {
    const flow = await api.flows.getById({ id: params.flowId });

    const initialNodes: FlowNode[] = flow.primitives
      .sort((a, b) =>
        a.type === "iterator" ? -1 : b.type === "iterator" ? 1 : 0,
      )
      .map(
        (primitive) =>
          ({
            id: primitive.id,
            type: primitive.type as FlowNode["type"],
            dragHandle:
              primitive.type !== "iterator-input" &&
              primitive.type !== "iterator-output"
                ? ".drag-handle"
                : undefined,
            draggable:
              primitive.type !== "iterator-input" &&
              primitive.type !== "iterator-output",
            deletable:
              primitive.type !== "route" &&
              primitive.type !== "workflow" &&
              primitive.type !== "iterator-input" &&
              primitive.type !== "iterator-output",
            position: { x: primitive.positionX, y: primitive.positionY },
            parentId: primitive.parentId ?? undefined,
            extent: primitive.parentId ? "parent" : undefined,
            data: {
              id: primitive.id,
              name: primitive.name,
              description: primitive.description,
              type: primitive.type,
              metadata: primitive.metadata,
              createdAt: primitive.createdAt,
              updatedAt: primitive.updatedAt,
              createdBy: primitive.createdBy,
              flowId: primitive.flowId,
            } as Primitive,
          }) as FlowNode,
      );

    const initialEdges: FlowEdge[] = flow.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: "deletable-edge",
    }));

    return (
      <div className="flex size-full flex-col gap-2 py-2 pr-2">
        <div className="flex size-full border rounded-xl">
          <FlowBuilder
            flowId={flow.id}
            initialNodes={initialNodes}
            initialEdges={initialEdges}
          />
        </div>
      </div>
    );
  } catch (error) {
    notFound();
  }
}
