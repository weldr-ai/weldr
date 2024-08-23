"use server";

import type { BaseFormState } from "@integramind/shared/types";
import { formDataToStructuredObject } from "@integramind/shared/utils";
import { insertFlowSchema } from "@integramind/shared/validators/flows";
import { TRPCError } from "@trpc/server";
import { revalidatePath } from "next/cache";

import { api } from "~/lib/trpc/rsc";

interface FormFields {
  name: string;
}

type FormState = BaseFormState<
  FormFields,
  {
    id: string;
  }
>;

export async function createFlow(
  prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const data = Object.fromEntries(formData) as Record<string, string>;
  const dataStructured = formDataToStructuredObject(data);
  const validation = insertFlowSchema.safeParse(dataStructured);

  const fields = Object.entries(data).reduce((acc, [key, value]) => {
    acc[key as keyof FormFields] = value;
    return acc;
  }, {} as FormFields);

  try {
    if (validation.success) {
      const workspace = await api.workspaces.getById({
        id: validation.data.workspaceId,
      });

      let result: { id: string };

      const commonData = {
        name: validation.data.name,
        description: validation.data.description,
        workspaceId: workspace.id,
      };

      if (validation.data.type === "route") {
        result = await api.flows.create({
          ...commonData,
          type: "route",
          metadata: validation.data.metadata,
        });
      } else if (validation.data.type === "workflow") {
        result = await api.flows.create({
          ...commonData,
          type: "workflow",
          metadata: validation.data.metadata,
        });
      } else {
        result = await api.flows.create({
          ...commonData,
          type: "component",
        });
      }

      revalidatePath("/workspaces/[id]", "layout");
      return { status: "success", payload: { id: result.id } };
    }

    const errors = validation.error.issues.reduce((acc, issue) => {
      acc[issue.path[0] as keyof FormFields] = issue.message;
      return acc;
    }, {} as FormFields);

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
