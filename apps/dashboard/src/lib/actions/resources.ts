"use server";

import type { BaseFormState } from "@integramind/shared/types";
import { formDataToStructuredObject } from "@integramind/shared/utils";
import { insertResourceSchema } from "@integramind/shared/validators/resources";
import { revalidatePath } from "next/cache";
import type { z } from "zod";

import { api } from "~/lib/trpc/rsc";

interface FormFields {
  name: string;
  description: string;
  workspaceId: string;
  provider: string;
  metadata: Record<string, string>;
}

type FormState = BaseFormState<
  FormFields,
  {
    id: string;
  }
>;

export async function addResource(
  prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const data = Object.fromEntries(formData) as Record<string, string>;
  const dataStructured = formDataToStructuredObject(data);
  const validation = insertResourceSchema.safeParse(dataStructured);

  const fields = Object.entries(data).reduce(
    (acc: Record<keyof FormFields, string>, [key, value]) => {
      acc[key as keyof FormFields] = value;
      return acc;
    },
    {} as Record<keyof FormFields, string>,
  );

  try {
    if (validation.success) {
      const workspace = await api.workspaces.getById({
        id: validation.data.workspaceId,
      });

      const result = await api.resources.create({
        name: validation.data.name,
        description: validation.data.description,
        workspaceId: workspace.id,
        provider: validation.data.provider,
        metadata: validation.data.metadata,
      });

      revalidatePath("/workspaces/[id]", "layout");
      return { status: "success", payload: { id: result.id } };
    }

    const errors = validation.error.issues.reduce(
      (acc: Record<keyof FormFields, string>, issue: z.ZodIssue) => {
        const key = issue.path[0] as keyof FormFields;
        acc[key] = issue.message;
        return acc;
      },
      {} as Record<keyof FormFields, string>,
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
