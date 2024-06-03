import { notFound } from "next/navigation";

import type { FlowEdge, FlowType, Primitive } from "~/types";
import { FlowBuilder } from "~/components/flow-builder";
import { getFlowById } from "~/lib/actions/flows";

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

  const initialPrimitives: Primitive[] = flow.primitives.map((primitive) => {
    switch (primitive.type) {
      case "route":
        return {
          id: primitive.id,
          type: primitive.type,
          position: { x: 0, y: 0 },
          data: {
            id: primitive.id,
            name: primitive.name,
            description: primitive.description,
            actionType: primitive.actionType,
            urlPath: primitive.urlPath,
          },
        };
      case "workflow":
        return {
          id: primitive.id,
          type: primitive.type,
          position: { x: 0, y: 0 },
          data: {
            id: primitive.id,
            name: primitive.name,
            description: primitive.description,
            triggerType: primitive.triggerType,
          },
        };
      case "function":
        return {
          id: primitive.id,
          type: primitive.type,
          position: { x: 0, y: 0 },
          data: {
            id: primitive.id,
            name: primitive.name,
            description: primitive.description,
            inputs: primitive.inputs,
            outputs: primitive.outputs,
            generatedCode: primitive.generatedCode,
            isCodeUpdated: primitive.isCodeUpdated,
          },
        };
    }
  });

  const initialEdges: FlowEdge[] = flow.edges;

  return (
    <FlowBuilder
      flowId={flow.id}
      initialPrimitives={initialPrimitives ?? []}
      initialEdges={initialEdges}
    />
  );
}
