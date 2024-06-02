import { notFound } from "next/navigation";

import type { FlowEdge, Primitive } from "~/types";
import { FlowBuilder } from "~/components/flow-builder";
import { getWorkflowById } from "~/lib/actions/workflows";

export default async function WorkflowPage({
  params,
}: {
  params: { workflowId: string };
}): Promise<JSX.Element> {
  const workflow = await getWorkflowById({ id: params.workflowId });

  console.log(workflow);

  if (!workflow) {
    notFound();
  }

  const initialPrimitives: Primitive[] = workflow.flow.primitives.map(
    (primitive) => ({
      id: primitive.id,
      type: primitive.type,
      position: { x: 0, y: 0 },
      data: {
        id: primitive.id,
        name: workflow.name,
        description: workflow.description,
        triggerType: workflow.triggerType,
      },
    }),
  );

  const initialEdges: FlowEdge[] = workflow.flow.edges.map((edge) => ({
    ...edge,
  }));

  return (
    <FlowBuilder
      flowId={workflow.id}
      flowType="workflow"
      initialPrimitives={initialPrimitives}
      initialEdges={initialEdges}
    />
  );
}
