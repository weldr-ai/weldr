"use server";

import type { z } from "zod";

import { db, eq, sql } from "@integramind/db";
import { insertResourceSchema, resources } from "@integramind/db/schema";
import type { Table } from "@integramind/integrations-postgres";
import { getInfo } from "@integramind/integrations-postgres";

import type { Resource, ResourceMetadata } from "~/types";

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

export async function addResource(
  prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const data = Object.fromEntries(formData) as Record<string, string>;
  const validation = insertResourceSchema.safeParse(data);

  const fields: Record<string, string> = Object.entries(data).reduce(
    (acc: Record<string, string>, [key, value]) => {
      acc[key] = value;
      return acc;
    },
    {},
  );

  try {
    if (validation.success) {
      let metadata: ResourceMetadata | undefined;

      if (validation.data.provider === "postgres") {
        metadata = {
          provider: "postgres",
          host: validation.data.host,
          port: Number(validation.data.port),
          user: validation.data.user,
          password: validation.data.password,
          database: validation.data.database,
        };
      }

      if (!metadata) {
        return { status: "error", fields };
      }

      const result = (
        await db
          .insert(resources)
          .values({
            name: validation.data.name,
            description: validation.data.description,
            provider: validation.data.provider,
            metadata: sql`${{ ...metadata }}`,
            workspaceId: validation.data.workspaceId,
          })
          .returning({ id: resources.id })
      )[0];

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

export async function getResourceById({ id }: { id: string }): Promise<
  | (Resource & {
      metadata: {
        tables: Table[];
      };
    })
  | undefined
> {
  const result = await db.select().from(resources).where(eq(resources.id, id));

  if (!result[0]) {
    return;
  }

  if (result[0].provider === "postgres") {
    const auth = result[0].metadata;

    const tables = await getInfo({
      auth: {
        host: auth.host,
        port: auth.port,
        user: auth.user,
        password: auth.password,
        database: auth.database,
      },
    });

    return {
      ...result[0],
      metadata: {
        ...result[0].metadata,
        tables,
      },
    };
  }
}

export async function getResources({ workspaceId }: { workspaceId: string }) {
  const result = await db
    .select()
    .from(resources)
    .where(eq(resources.workspaceId, workspaceId));
  return result;
}
