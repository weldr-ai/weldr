"use server";

import type { BaseFormState } from "@integramind/shared/types";
import { formDataToStructuredObject } from "@integramind/shared/utils";
import { insertResourceSchema } from "@integramind/shared/validators/resources";
import { TRPCError } from "@trpc/server";
import { revalidatePath } from "next/cache";
import type { z } from "zod";

import { api } from "~/lib/trpc/rsc";
type FormState = BaseFormState;

export async function addResource(
  prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const data = Object.fromEntries(formData) as Record<string, string>;
  const dataStructured = formDataToStructuredObject(data);
  const validation = insertResourceSchema.safeParse(dataStructured);

  const fields = Object.entries(data).reduce(
    (acc: Record<string, string>, [key, value]) => {
      acc[key] = value;
      return acc;
    },
    {} as Record<string, string>,
  );

  try {
    if (validation.success) {
      const result = await api.resources.create({
        name: validation.data.name,
        description: validation.data.description,
        workspaceId: validation.data.workspaceId,
        integrationId: validation.data.integrationId,
        environmentVariables: validation.data.environmentVariables,
      });
      revalidatePath("/workspaces", "layout");
      return { status: "success", payload: { id: result.id } };
    }

    const errors = validation.error.issues.reduce(
      (acc: Record<string, string>, issue: z.ZodIssue) => {
        const key = issue.path[0] as string;
        acc[key] = issue.message;
        return acc;
      },
      {} as Record<string, string>,
    );

    return {
      status: "validationError",
      fields,
      errors,
    };
  } catch (error) {
    if (error instanceof TRPCError) {
      return {
        status: "error",
        fields,
        message: error.message,
      };
    }
    return { status: "error", fields };
  }
}
