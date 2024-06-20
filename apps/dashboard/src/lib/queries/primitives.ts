"use server";

import type { z } from "zod";

import type { updateRouteFlowSchema } from "@integramind/db/schema";
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

export async function updatePrimitiveRouteById({
  id,
  name,
  description,
  actionType,
  urlPath,
  inputs,
}: z.infer<typeof updateRouteFlowSchema> & { id: string }) {
  const result = await db.query.primitives.findFirst({
    where: eq(primitives.id, id),
  });

  if (!result || result.metadata.type !== "route") {
    return;
  }

  await db
    .update(primitives)
    .set({
      name: name,
      description: description,
      metadata: sql`${{
        type: "route",
        actionType: actionType ?? result.metadata.actionType,
        urlPath: urlPath ?? result.metadata.urlPath,
        inputs: inputs
          ? inputs.map((input) => ({ name: input.name, type: input.type }))
          : result.metadata.inputs,
      }}`,
    })
    .where(eq(primitives.id, id));
}
