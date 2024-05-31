import { notFound } from "next/navigation";

import type { Block, FlowEdge } from "~/types";
import { FlowBuilder } from "~/components/flow-builder";
import { getCompoundBlockById } from "~/lib/actions/compound-blocks";

export default async function CompoundBlock({
  params,
}: {
  params: { compoundBlockId: string };
}): Promise<JSX.Element> {
  const compoundBlocks = await getCompoundBlockById({
    id: params.compoundBlockId,
  });

  if (!compoundBlocks) {
    notFound();
  }

  const initialBlocks: Block[] = compoundBlocks.flow.nodes.map((node) => ({
    id: node.id,
    type: node.type,
    position: { x: 0, y: 0 },
    data: {
      id: node.id,
      name: compoundBlocks.name,
      description: compoundBlocks.description,
    },
  }));

  const initialEdges: FlowEdge[] = compoundBlocks.flow.edges.map((edge) => ({
    ...edge,
  }));

  return (
    <FlowBuilder initialBlocks={initialBlocks} initialEdges={initialEdges} />
  );
}
