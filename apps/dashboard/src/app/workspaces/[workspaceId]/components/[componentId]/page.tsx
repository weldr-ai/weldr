import { notFound } from "next/navigation";

import type { FlowEdge, Primitive } from "~/types";
import { FlowBuilder } from "~/components/flow-builder";
import { getComponentById } from "~/lib/actions/components";

export default async function ComponentPage({
  params,
}: {
  params: { componentId: string };
}): Promise<JSX.Element> {
  const components = await getComponentById({
    id: params.componentId,
  });

  if (!components) {
    notFound();
  }

  const initialPrimitives: Primitive[] = components.flow.primitives.map(
    (primitive) => ({
      id: primitive.id,
      type: primitive.type,
      position: { x: 0, y: 0 },
      data: {
        id: primitive.id,
        name: components.name,
        description: components.description,
      },
    }),
  );

  const initialEdges: FlowEdge[] = components.flow.edges.map((edge) => ({
    ...edge,
  }));

  return (
    <FlowBuilder
      flowId={components.id}
      flowType="component"
      initialPrimitives={initialPrimitives}
      initialEdges={initialEdges}
    />
  );
}
