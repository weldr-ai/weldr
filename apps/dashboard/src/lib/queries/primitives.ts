"use server";

import type { z } from "zod";

import type {
  updateFunctionSchema,
  updateRouteFlowSchema,
} from "@integramind/db/schema";
import { db, eq, sql } from "@integramind/db";
import { primitives } from "@integramind/db/schema";

import type { Input } from "~/types";

// FIXME: many of these queries should be optimized

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

export async function getPrimitiveById({ id }: { id: string }) {
  const result = await db.query.primitives.findFirst({
    where: eq(primitives.id, id),
  });
  return result;
}

export async function updateRouteById({
  id,
  name,
  description,
  actionType,
  urlPath,
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
        inputs: result.metadata.inputs,
      }}::jsonb`,
    })
    .where(eq(primitives.id, id));
}

export async function updateInput({
  id,
  inputId,
  name,
}: {
  id: string;
  inputId: string;
  name: string;
}) {
  function updateInputById(inputs: Input[], id: string, name: string): Input[] {
    return inputs.map((input) =>
      input.id === id ? { ...input, name } : input,
    );
  }

  const result = await db.query.primitives.findFirst({
    where: eq(primitives.id, id),
  });

  if (!result || result.metadata.type !== "route") {
    return;
  }

  await db
    .update(primitives)
    .set({
      metadata: sql`${{
        ...result.metadata,
        inputs: [...updateInputById(result.metadata.inputs, inputId, name)],
      }}::jsonb`,
    })
    .where(eq(primitives.id, id));
}

export async function addInput({
  id,
  inputId,
  name,
  type,
}: {
  id: string;
  inputId: string;
  name: string;
  type: "text" | "number";
}) {
  const result = await db.query.primitives.findFirst({
    where: eq(primitives.id, id),
  });

  if (!result || result.metadata.type !== "route") {
    return;
  }

  await db
    .update(primitives)
    .set({
      metadata: sql`${{
        ...result.metadata,
        inputs: [
          ...(result.metadata.inputs ? result.metadata.inputs : []),
          { id: inputId, name, type },
        ],
      }}::jsonb`,
    })
    .where(eq(primitives.id, id));
}

export async function updateFunctionById({
  id,
  name,
  description,
}: z.infer<typeof updateFunctionSchema> & { id: string }) {
  const result = await db.query.primitives.findFirst({
    where: eq(primitives.id, id),
  });

  if (!result || result.metadata.type !== "function") {
    return;
  }

  await db
    .update(primitives)
    .set({
      name: name,
      description: description,
    })
    .where(eq(primitives.id, id));
}
