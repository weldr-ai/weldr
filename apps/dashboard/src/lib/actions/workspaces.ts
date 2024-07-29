"use server";

import { insertWorkspaceSchema } from "@integramind/shared/validators/workspaces";
import { revalidatePath } from "next/cache";
import type { z } from "zod";

import { api } from "~/lib/trpc/rsc";

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
      const result = await api.workspaces.create({
        name: validation.data.name,
      });

      if (result) {
        revalidatePath("/workspaces/[id]", "layout");
        return { status: "success", payload: { id: result.id } };
      }
      return { status: "error", fields };
    }
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
  } catch (error) {
    return { status: "error", fields };
  }
}
