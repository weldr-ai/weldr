import { notFound } from "next/navigation";

import type { FlowEdge, Primitive } from "~/types";
import { FlowBuilder } from "~/components/flow-builder";
import { getAccessPointById } from "~/lib/actions/access-points";

export default async function AccessPointPage({
  params,
}: {
  params: { accessPointId: string };
}): Promise<JSX.Element> {
  const accessPoint = await getAccessPointById({ id: params.accessPointId });

  if (!accessPoint) {
    notFound();
  }

  const initialPrimitives: Primitive[] = accessPoint.flow.primitives.map(
    (primitive) => ({
      id: primitive.id,
      type: primitive.type,
      position: { x: 0, y: 0 },
      data: {
        id: primitive.id,
        name: accessPoint.name,
        description: accessPoint.description,
        actionType: accessPoint.actionType,
        urlPath: accessPoint.urlPath,
      },
    }),
  );

  const initialEdges: FlowEdge[] = accessPoint.flow.edges.map((edge) => ({
    ...edge,
  }));

  return (
    <FlowBuilder
      flowId={accessPoint.id}
      flowType="access-point"
      initialPrimitives={initialPrimitives}
      initialEdges={initialEdges}
    />
  );
}
