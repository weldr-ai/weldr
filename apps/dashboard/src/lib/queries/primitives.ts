"use server";

import { db, eq, sql } from "@integramind/db";
import { primitives } from "@integramind/db/schema";

export async function createPrimitive({
  id,
  type,
  name,
  flowId,
  positionX,
  positionY,
}: {
  id: string;
  type: "function" | "conditional-branch" | "loop" | "response";
  name: string;
  flowId: string;
  positionX: number;
  positionY: number;
}) {
  const result = await db.insert(primitives).values({
    id,
    type,
    name,
    positionX,
    positionY,
    flowId,
    metadata: sql`${{
      type,
    }}`,
  });
  return result;
}

export async function deletePrimitive({ id }: { id: string }) {
  await db.delete(primitives).where(eq(primitives.id, id));
}

export async function updatePrimitivePosition({
  id,
  positionX,
  positionY,
}: {
  id: string;
  positionX: number;
  positionY: number;
}) {
  await db
    .update(primitives)
    .set({
      positionX,
      positionY,
    })
    .where(eq(primitives.id, id));
}
