"use server";

import type { z } from "zod";

import { db, eq, sql } from "@integramind/db";
import { components, insertComponentSchema } from "@integramind/db/schema";

import type { Component, PrimitiveType } from "~/types";
import { getWorkspaceById } from "./workspaces";

interface FormFields {
  name?: string;
  description?: string;
}

type FormState =
  | {
      status: "success";
      payload: {
        id: string;
      };
    }
  | {
      status: "validationError";
      fields: FormFields;
      errors: FormFields;
    }
  | {
      status: "error";
      fields: FormFields;
    }
  | undefined;

export async function createComponent(
  prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const data = Object.fromEntries(formData);
  const validation = insertComponentSchema.safeParse(data);

  const fields: FormFields = Object.keys(data).reduce(
    (acc: FormFields, key: string) => {
      const fieldName = key as "name" | "description";
      const data = acc[fieldName];
      if (data) {
        acc[fieldName] = data.toString();
      }
      return acc;
    },
    {},
  );

  try {
    if (validation.success) {
      const workspace = await getWorkspaceById({
        id: validation.data.workspaceId,
      });

      if (!workspace) {
        return { status: "error", fields };
      }

      const result = (
        await db
          .insert(components)
          .values({
            ...validation.data,
          })
          .returning({ id: components.id })
      )[0];

      if (result) {
        return { status: "success", payload: { id: result.id } };
      } else {
        return { status: "error", fields };
      }
    } else {
      const errors = validation.error.issues.reduce(
        (acc: Record<string, string>, issue: z.ZodIssue) => {
          const key = issue.path[0] as string;
          acc[key] = issue.message;
          return acc;
        },
        {},
      );
      return {
        status: "validationError",
        fields,
        errors,
      };
    }
  } catch (error) {
    console.log(error);
    return { status: "error", fields };
  }
}

export async function getComponents({
  workspaceId,
}: {
  workspaceId: string;
}): Promise<Component[]> {
  const result = await db
    .select()
    .from(components)
    .where(eq(components.workspaceId, workspaceId));
  return result;
}

export async function getComponentById({
  id,
}: {
  id: string;
}): Promise<Component | undefined> {
  const result = (
    await db.select().from(components).where(eq(components.id, id))
  )[0];
  return result;
}

export async function updateComponentFlowPrimitives({
  id,
  primitive,
}: {
  id: string;
  primitive: { id: string; type: PrimitiveType };
}): Promise<{ id: string } | undefined> {
  const statement = sql`
    UPDATE ${components}
    SET flow = jsonb_set(
      ${components.flow},
      '{primitives}',
      (${components.flow} -> 'primitives') || ${{ id: primitive.id, type: primitive.type }}::jsonb
    )
    WHERE id = ${id}
    RETURNING id;`;
  const result = (await db.execute(statement))[0] as { id: string } | undefined;
  return result;
}
