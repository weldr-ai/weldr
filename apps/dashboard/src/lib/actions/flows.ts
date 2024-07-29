"use server";

import { insertFlowSchema } from "@integramind/shared/validators/flows";
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

  const validation = insertFlowSchema.safeParse(data);

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

      const result = await api.flows.create({
        name: validation.data.name,
        description: validation.data.description,
        workspaceId: validation.data.workspaceId,
        type: validation.data.type,
      });

      if (result) {
        if (
          validation.data.type === "route" ||
          validation.data.type === "workflow"
        ) {
          await api.primitives.create({
            name: validation.data.name,
            description: validation.data.description,
            type: validation.data.type,
            metadata: validation.data.metadata,
            flowId: result.id,
          });
        }
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
    console.log(error);
    return { status: "error", fields };
  }
}
