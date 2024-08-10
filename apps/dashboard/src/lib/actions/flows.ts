"use server";

import { formDataToStructuredObject } from "@integramind/shared/utils";
import { insertFlowSchema } from "@integramind/shared/validators/flows";
import { revalidatePath } from "next/cache";
import type { z } from "zod";

import { api } from "~/lib/trpc/rsc";

type FormState =
  | {
      status: "success";
      payload: {
        id: string;
      };
    }
  | {
      status: "validationError";
      fields: Record<string, string>;
      errors: Record<string, string>;
    }
  | {
      status: "error";
      fields: Record<string, string>;
    }
  | undefined;

export async function createFlow(
  prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const data = Object.fromEntries(formData) as Record<string, string>;
  const dataStructured = formDataToStructuredObject(data);
  const validation = insertFlowSchema.safeParse(dataStructured);

  const fields: Record<string, string> = Object.entries(data).reduce(
    (acc: Record<string, string>, [key, value]) => {
      acc[key] = value;
      return acc;
    },
    {} as Record<string, string>,
  );

  try {
    if (validation.success) {
      const workspace = api.workspaces.getById({
        id: validation.data.workspaceId,
      });

      if (!workspace) {
        return { status: "error", fields };
      }

      let result: { id: string };

      const commonData = {
        name: validation.data.name,
        description: validation.data.description,
        workspaceId: validation.data.workspaceId,
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

      if (!result) {
        return { status: "error", fields };
      }

      revalidatePath("/workspaces/[id]", "layout");
      return { status: "success", payload: { id: result.id } };
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
    console.log(error);
    return { status: "error", fields };
  }
}
