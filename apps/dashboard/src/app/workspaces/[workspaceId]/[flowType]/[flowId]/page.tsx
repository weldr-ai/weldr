import { notFound } from "next/navigation";

import type { FlowEdge, FlowNode } from "~/types";
import { FlowBuilder } from "~/components/flow-builder";
import { getFlowById } from "~/lib/queries/flows";

export default async function WorkflowPage({
  params,
}: {
  params: { flowType: string; flowId: string };
}): Promise<JSX.Element> {
  const flow = await getFlowById({
    id: params.flowId,
  });

  if (!flow) {
    notFound();
  }

  const initialNodes: FlowNode[] = flow.primitives.map((primitive) => {
    switch (primitive.metadata.type) {
      case "route":
        return {
          id: primitive.id,
          type: primitive.type,
          dragHandle: ".drag-handle",
          deletable: false,
          position: { x: primitive.positionX, y: primitive.positionY },
          data: {
            id: primitive.id,
            name: primitive.name,
            description: primitive.description,
            type: primitive.type,
            actionType: primitive.metadata.actionType,
            urlPath: primitive.metadata.urlPath,
            inputs: primitive.metadata.inputs,
          },
        };
      case "workflow":
        return {
          id: primitive.id,
          type: primitive.type,
          dragHandle: ".drag-handle",
          deletable: false,
          position: { x: primitive.positionX, y: primitive.positionY },
          data: {
            id: primitive.id,
            name: primitive.name,
            description: primitive.description,
            type: primitive.type,
            triggerType: primitive.metadata.triggerType,
            inputs: primitive.metadata.inputs,
          },
        };
      case "function":
        return {
          id: primitive.id,
          type: primitive.type,
          dragHandle: ".drag-handle",
          position: { x: primitive.positionX, y: primitive.positionY },
          data: {
            id: primitive.id,
            name: primitive.name,
            description: primitive.description,
            type: primitive.type,
            inputs: primitive.metadata.inputs,
            outputs: primitive.metadata.outputs,
            resource: primitive.metadata.resource,
            rawDescription: primitive.metadata.rawDescription,
          },
        };
    }
  });

  const initialEdges: FlowEdge[] = flow.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: "deletable-edge",
  }));

  return (
    <div className="flex size-full flex-col gap-2 py-2 pr-2">
      <div className="flex size-full rounded-xl border">
        <FlowBuilder
          flowId={flow.id}
          initialNodes={initialNodes}
          initialEdges={initialEdges}
        />
      </div>
    </div>
  );
}
