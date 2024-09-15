"use server";

import type { BaseFormState } from "@specly/shared/types";
import { insertWorkspaceSchema } from "@specly/shared/validators/workspaces";
import { revalidatePath } from "next/cache";
import type { z } from "zod";

import { api } from "~/lib/trpc/rsc";

interface FormFields {
  name?: string;
  description?: string;
}

type FormState = BaseFormState<
  FormFields,
  {
    id: string;
  }
>;

export async function createWorkspace(
  prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const data = Object.fromEntries(formData);
  const validation = insertWorkspaceSchema.safeParse(data);

  const fields = Object.keys(data).reduce((acc: FormFields, key: string) => {
    const fieldName = key as keyof FormFields;
    const data = acc[fieldName];
    if (data) {
      acc[fieldName] = data.toString();
    }
    return acc;
  }, {} as FormFields);

  try {
    if (validation.success) {
      const result = await api.workspaces.create({
        name: validation.data.name,
        subdomain: validation.data.subdomain,
        description: validation.data.description,
      });

      if (result) {
        revalidatePath("/workspaces/[id]", "layout");
        return { status: "success", payload: { id: result.id } };
      }

      return { status: "error", fields };
    }

    const errors = validation.error.issues.reduce(
      (acc: FormFields, issue: z.ZodIssue) => {
        const key = issue.path[0] as keyof FormFields;
        acc[key] = issue.message;
        return acc;
      },
      {} as FormFields,
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
