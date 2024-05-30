"use server";

import type { z } from "zod";
import { revalidatePath } from "next/cache";

import { db, eq } from "@integramind/db";
import { insertWorkspaceSchema, workspaces } from "@integramind/db/schema";

import type { Workspace } from "~/types";

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

export async function createWorkspace(
  prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const data = Object.fromEntries(formData);
  const validation = insertWorkspaceSchema.safeParse(data);

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
      const result = (
        await db
          .insert(workspaces)
          .values({
            ...validation.data,
          })
          .returning({ id: workspaces.id })
      )[0];

      if (result) {
        revalidatePath("/workspaces/[id]", "layout");
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
    return { status: "error", fields };
  }
}

export async function getWorkspaces(): Promise<Workspace[]> {
  const result = await db.select().from(workspaces);
  return result;
}

export async function deleteWorkspace({ id }: { id: string }) {
  await db.delete(workspaces).where(eq(workspaces.id, id));
}
