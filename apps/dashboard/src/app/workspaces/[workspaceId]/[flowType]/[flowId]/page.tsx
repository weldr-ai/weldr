import { notFound } from "next/navigation";

import type {
  FlowEdge,
  FlowNode,
  FlowType,
  FunctionMetadata,
  RouteMetadata,
  WorkflowMetadata,
} from "~/types";
import { FlowBuilder } from "~/components/flow-builder";
import { getFlowById } from "~/lib/queries/flows";

export default async function WorkflowPage({
  params,
}: {
  params: { flowType: string; flowId: string };
}): Promise<JSX.Element> {
  const flowType = params.flowType.slice(0, -1) as FlowType;
  const flow = await getFlowById({
    id: params.flowId,
    type: flowType,
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
          position: { x: primitive.positionX, y: primitive.positionY },
          data: {
            id: primitive.id,
            name: primitive.name,
            description: primitive.description,
            actionType: (primitive.metadata as RouteMetadata).actionType,
            urlPath: (primitive.metadata as RouteMetadata).urlPath,
          },
        };
      case "workflow":
        return {
          id: primitive.id,
          type: primitive.type,
          dragHandle: ".drag-handle",
          position: { x: primitive.positionX, y: primitive.positionY },
          data: {
            id: primitive.id,
            name: primitive.name,
            description: primitive.description,
            triggerType: (primitive.metadata as WorkflowMetadata).triggerType,
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
            inputs: (primitive.metadata as FunctionMetadata).inputs,
            outputs: (primitive.metadata as FunctionMetadata).outputs,
            generatedCode: (primitive.metadata as FunctionMetadata)
              .generatedCode,
            isCodeUpdated: (primitive.metadata as FunctionMetadata)
              .isCodeUpdated,
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
