import { notFound } from "next/navigation";

import type { Block, FlowEdge } from "~/types";
import { FlowBuilder } from "~/components/flow-builder";
import { getAccessPointById } from "~/lib/actions/access-points";

export default async function AccessPoint({
  params,
}: {
  params: { accessPointId: string };
}): Promise<JSX.Element> {
  const accessPoint = await getAccessPointById({ id: params.accessPointId });

  if (!accessPoint) {
    notFound();
  }

  const initialBlocks: Block[] = accessPoint.flow.nodes.map((node) => ({
    id: node.id,
    type: node.type,
    position: { x: 0, y: 0 },
    data: {
      id: node.id,
      name: accessPoint.name,
      description: accessPoint.description,
      actionType: accessPoint.actionType,
      urlPath: accessPoint.urlPath,
    },
  }));

  const initialEdges: FlowEdge[] = accessPoint.flow.edges.map((edge) => ({
    ...edge,
  }));

  return (
    <FlowBuilder initialBlocks={initialBlocks} initialEdges={initialEdges} />
  );
}
