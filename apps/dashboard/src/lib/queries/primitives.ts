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
  type: "function" | "conditional-branch" | "iterator" | "response";
  name: string;
  flowId: string;
  positionX: number;
  positionY: number;
}) {
  await db.insert(primitives).values({
    id,
    type,
    name,
    positionX: Math.floor(positionX),
    positionY: Math.floor(positionY),
    flowId,
    metadata: sql`${{
      type,
    }}`,
  });
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
      positionX: Math.floor(positionX),
      positionY: Math.floor(positionY),
    })
    .where(eq(primitives.id, id));
}
