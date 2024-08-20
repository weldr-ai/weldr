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

    const initialNodes: FlowNode[] = flow.primitives.map((primitive) => ({
      id: primitive.id,
      type: primitive.type,
      dragHandle: ".drag-handle",
      deletable: primitive.type !== "route" && primitive.type !== "workflow",
      position: { x: primitive.positionX, y: primitive.positionY },
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
    }));

    const initialEdges: FlowEdge[] = flow.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: "deletable-edge",
    }));

    return (
      <div className="flex size-full flex-col gap-2 py-2 pr-2">
        <div className="flex size-full">
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
