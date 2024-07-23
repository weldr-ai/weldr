import { and, eq, sql } from "drizzle-orm";

import { db } from "..";
import { flows, primitives } from "../schema";
import type { Edge, Flow, Primitive, RouteMetadata } from "../types";

export async function getFlowById({
  id,
  workspaceId,
}: {
  id: string;
  workspaceId: string;
}): Promise<(Flow & { edges: Edge[]; primitives: Primitive[] }) | undefined> {
  const result = await db.query.flows.findFirst({
    where: and(eq(flows.id, id), eq(flows.workspaceId, workspaceId)),
    with: {
      primitives: true,
      edges: true,
    },
  });
  return result;
}

export async function getRouteFlowByPath({
  workspaceId,
  urlPath,
}: {
  workspaceId: string;
  urlPath: string;
}): Promise<
  | {
      flow: Flow & { primitives: Primitive[]; edges: Edge[] };
      config: Omit<RouteMetadata, "type">;
    }
  | undefined
> {
  const result = await db
    .select({
      metadata: primitives.metadata,
      flowId: primitives.flowId,
    })
    .from(primitives)
    .where(
      and(
        eq(primitives.type, "route"),
        sql`primitives.metadata::jsonb->>'urlPath' = ${urlPath}`,
      ),
    );

  if (!result[0]) {
    return;
  }

  const flow = await getFlowById({
    id: result[0].flowId,
    workspaceId,
  });

  if (!flow) {
    return;
  }

  return {
    flow,
    config: {
      actionType: (result[0].metadata as RouteMetadata).actionType,
      urlPath: (result[0].metadata as RouteMetadata).urlPath,
      inputs: (result[0].metadata as RouteMetadata).inputs,
    },
  };
}
