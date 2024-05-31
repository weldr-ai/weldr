"use server";

import type { z } from "zod";

import { db, eq } from "@integramind/db";
import { accessPoints, insertAccessPointSchema } from "@integramind/db/schema";

import type { AccessPoint } from "~/types";
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

      const result = (
        await db
          .insert(accessPoints)
          .values({
            ...validation.data,
            id,
            flow: {
              nodes: [
                {
                  id,
                  type: "access-point-block",
                },
              ],
              edges: [],
            },
          })
          .returning({ id: accessPoints.id })
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
