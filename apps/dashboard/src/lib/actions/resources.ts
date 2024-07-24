"use server";

import { z } from "zod";

import {
  insertResourceSchema,
  postgresMetadataSchema,
} from "@integramind/db/schema";

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

const validationSchema = insertResourceSchema.extend({
  metadata: z.discriminatedUnion("provider", [postgresMetadataSchema]),
});

export async function addResource(
  prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const data = Object.fromEntries(formData) as Record<string, string>;
  const validation = validationSchema.safeParse(data);

  const fields: Record<string, string> = Object.entries(data).reduce(
    (acc: Record<string, string>, [key, value]) => {
      acc[key] = value;
      return acc;
    },
    {},
  );

  try {
    if (validation.success) {
      const result = await api.resources.create({
        name: validation.data.name,
        description: validation.data.description,
        provider: validation.data.provider,
        metadata: validation.data.metadata,
        workspaceId: validation.data.workspaceId,
      });

      if (result) {
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
