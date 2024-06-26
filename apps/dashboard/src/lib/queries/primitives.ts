"use server";

import type { z } from "zod";

import type {
  updateFunctionSchema,
  updateRouteFlowSchema,
} from "@integramind/db/schema";
import { and, db, eq, sql } from "@integramind/db";
import { primitives } from "@integramind/db/schema";

import type { Input, RouteData, RouteMetadata } from "~/types";

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

export async function getRoutePrimitiveById({
  id,
}: {
  id: string;
}): Promise<RouteData | undefined> {
  const result = await db.query.primitives.findFirst({
    where: and(eq(primitives.id, id), eq(primitives.type, "route")),
  });

  if (!result) {
    return;
  }

  return {
    id: result.id,
    name: result.name,
    description: result.description,
    type: "route",
    actionType: (result.metadata as RouteMetadata).actionType,
    urlPath: (result.metadata as RouteMetadata).urlPath,
    inputs: (result.metadata as RouteMetadata).inputs,
  };
}

export async function updateRoutePrimitiveById({
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
        inputs: inputs ?? result.metadata.inputs,
      }}::jsonb`,
    })
    .where(eq(primitives.id, id));
}

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

export async function updateFunctionPrimitiveById({
  id,
  name,
  description,
  inputs,
  outputs,
  resource,
  rawDescription,
  generatedCode,
  isCodeUpdated,
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
      metadata: sql`${{
        ...result.metadata,
        inputs: inputs ?? result.metadata.inputs,
        outputs: outputs ?? result.metadata.outputs,
        resource: resource ?? result.metadata.resource,
        rawDescription: rawDescription ?? result.metadata.rawDescription,
        generatedCode: generatedCode ?? result.metadata.generatedCode,
        isCodeUpdated: isCodeUpdated ?? result.metadata.isCodeUpdated,
      }}::jsonb`,
    })
    .where(eq(primitives.id, id));
}
