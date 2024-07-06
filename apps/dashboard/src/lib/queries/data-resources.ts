"use server";

import type { z } from "zod";

import { db, eq, sql } from "@integramind/db";
import {
  dataResources,
  insertDataResourceSchema,
} from "@integramind/db/schema";
import { getTables } from "@integramind/db/utils";

import type { DataResource, DataResourceMetadata } from "~/types";

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

export async function addDataResource(
  prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const data = Object.fromEntries(formData) as Record<string, string>;
  const validation = insertDataResourceSchema.safeParse(data);

  const fields: Record<string, string> = Object.entries(data).reduce(
    (acc: Record<string, string>, [key, value]) => {
      acc[key] = value;
      return acc;
    },
    {},
  );

  try {
    if (validation.success) {
      let metadata: DataResourceMetadata;

      if (validation.data.provider === "postgres") {
        const result = await getTables(validation.data.connectionString);
        console.log(result);
        if (!result) {
          return { status: "error", fields };
        }
        metadata = {
          provider: "postgres",
          connectionString: validation.data.connectionString,
          tables: result,
        };
      }

      const result = (
        await db
          .insert(dataResources)
          .values({
            name: validation.data.name,
            description: validation.data.description,
            provider: validation.data.provider,
            metadata: sql`${{ ...metadata! }}`,
            workspaceId: validation.data.workspaceId,
          })
          .returning({ id: dataResources.id })
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
    return { status: "error", fields };
  }
}

export async function getDataResourceById({
  id,
}: {
  id: string;
}): Promise<DataResource | undefined> {
  const result = await db
    .select()
    .from(dataResources)
    .where(eq(dataResources.id, id));
  return result[0];
}

export async function getDataResources({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const result = await db
    .select()
    .from(dataResources)
    .where(eq(dataResources.workspaceId, workspaceId));
  return result;
}
