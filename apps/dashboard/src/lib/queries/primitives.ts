"use server";

import { db, eq, sql } from "@integramind/db";
import { primitives } from "@integramind/db/schema";

import type { Input } from "~/types";

export async function updateInput({
  id,
  inputId,
  name,
  testValue,
}: {
  id: string;
  inputId: string;
  name?: string;
  testValue?: string | number | null;
}) {
  function updateInputById(
    inputs: Input[],
    id: string,
    name?: string,
    testValue?: string | number | null,
  ): Input[] {
    return inputs.map((input) =>
      input.id === id
        ? {
            ...input,
            name: name ?? input.name,
            testValue: testValue ?? input.testValue,
          }
        : input,
    );
  }

  const result = await db.query.primitives.findFirst({
    where: eq(primitives.id, id),
  });

  if (!result || result.metadata.type !== "route") {
    return;
  }

  const updatedInputs = updateInputById(
    result.metadata.inputs,
    inputId,
    name,
    testValue,
  );

  await db
    .update(primitives)
    .set({
      metadata: sql`${{
        ...result.metadata,
        inputs: [...updatedInputs],
      }}::jsonb`,
    })
    .where(eq(primitives.id, id));

  return updatedInputs;
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
