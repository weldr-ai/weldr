import { notFound } from "next/navigation";

import type { Block, FlowEdge } from "~/types";
import { FlowBuilder } from "~/components/flow-builder";
import { getWorkflowById } from "~/lib/actions/workflows";

export default async function Workflow({
  params,
}: {
  params: { workflowId: string };
}): Promise<JSX.Element> {
  const workflow = await getWorkflowById({ id: params.workflowId });

  if (!workflow) {
    return notFound();
  }

  const initialBlocks: Block[] = workflow.flow.nodes.map((node) => ({
    id: node.id,
    type: node.type,
    position: { x: 0, y: 0 },
    data: { id: node.id, name: node.metadata.name },
  }));

  const initialEdges: FlowEdge[] = workflow.flow.edges.map((edge) => ({
    ...edge,
  }));

  return (
    <FlowBuilder initialBlocks={initialBlocks} initialEdges={initialEdges} />
  );
}
