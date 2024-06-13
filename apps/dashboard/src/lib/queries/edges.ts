"use server";

import { db, eq } from "@integramind/db";
import { edges } from "@integramind/db/schema";

export async function createEdge({
  id,
  source,
  target,
  flowId,
}: {
  id: string;
  source: string;
  target: string;
  flowId: string;
}) {
  await db.insert(edges).values({
    id,
    source,
    target,
    flow_id: flowId,
  });
}

export async function deleteEdge({ id }: { id: string }) {
  await db.delete(edges).where(eq(edges.id, id));
}
