"use server";

import type { z } from "zod";

import { db, eq, sql } from "@integramind/db";
import { accessPoints, insertAccessPointSchema } from "@integramind/db/schema";

import type { AccessPoint, PrimitiveType } from "~/types";
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

export async function createAccessPoint(
  prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const data = Object.fromEntries(formData);
  const validation = insertAccessPointSchema.safeParse(data);

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

  const id = crypto.randomUUID();

  try {
    if (validation.success) {
      const workspace = await getWorkspaceById({
        id: validation.data.workspaceId,
      });

      if (!workspace) {
        return { status: "error", fields };
      }

      const statement = sql`
        INSERT INTO ${accessPoints} (id, workspace_id, name, description, action_type, url_path, flow)
        VALUES (
          ${id},
          ${validation.data.workspaceId},
          ${validation.data.name},
          ${validation.data.description},
          ${validation.data.actionType},
          ${validation.data.urlPath},
          ${{
            primitives: [
              {
                id,
                type: "access-point",
              },
            ],
            edges: [],
          }}::jsonb
        )
        RETURNING id;`;

      const result = (await db.execute(statement))[0] as
        | { id: string }
        | undefined;

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

export async function updateAccessPointFlowPrimitives({
  id,
  primitive,
}: {
  id: string;
  primitive: { id: string; type: PrimitiveType };
}): Promise<{ id: string } | undefined> {
  const statement = sql`
    UPDATE ${accessPoints}
    SET flow = jsonb_set(
      ${accessPoints.flow},
      '{primitives}',
      (${accessPoints.flow} -> 'primitives') || ${{ id: primitive.id, type: primitive.type }}::jsonb
    )
    WHERE id = ${id}
    RETURNING id;`;
  const result = (await db.execute(statement))[0] as { id: string } | undefined;
  return result;
}

export async function getAccessPoints({
  workspaceId,
}: {
  workspaceId: string;
}): Promise<AccessPoint[]> {
  const result = await db
    .select()
    .from(accessPoints)
    .where(eq(accessPoints.workspaceId, workspaceId));
  return result;
}

export async function getAccessPointById({
  id,
}: {
  id: string;
}): Promise<AccessPoint | undefined> {
  const result = (
    await db.select().from(accessPoints).where(eq(accessPoints.id, id))
  )[0];
  return result;
}
