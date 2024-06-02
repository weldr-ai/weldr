"use server";

import type { z } from "zod";

import { db, eq, sql } from "@integramind/db";
import { insertWorkflowSchema, workflows } from "@integramind/db/schema";

import type { PrimitiveType, Workflow } from "~/types";
import { getWorkspaceById } from "./workspaces";

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

export async function createWorkflow(
  prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const data = Object.fromEntries(formData);
  const validation = insertWorkflowSchema.safeParse(data);

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

  const id = crypto.randomUUID();

  try {
    if (validation.success) {
      const workspace = await getWorkspaceById({
        id: validation.data.workspaceId,
      });

      if (!workspace) {
        return { status: "error", fields };
      }

      const statement = sql`
      INSERT INTO ${workflows} (id, workspace_id, name, description, trigger_type, flow)
      VALUES (
        ${id},
        ${validation.data.workspaceId},
        ${validation.data.name},
        ${validation.data.description},
        ${validation.data.triggerType},
        ${{
          primitives: [
            {
              id,
              type: "workflow",
            },
          ],
          edges: [],
        }}::jsonb
      )
      RETURNING id;`;

      const result = (await db.execute(statement))[0] as
        | { id: string }
        | undefined;

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
    console.log(error);
    return { status: "error", fields };
  }
}

export async function updateWorkflowFlowPrimitives({
  id,
  primitive,
}: {
  id: string;
  primitive: { id: string; type: PrimitiveType };
}): Promise<{ id: string } | undefined> {
  const statement = sql`
    UPDATE ${workflows}
    SET flow = jsonb_set(
      ${workflows.flow},
      '{primitives}',
      (${workflows.flow} -> 'primitives') || ${{ id: primitive.id, type: primitive.type }}::jsonb
    )
    WHERE id = ${id}
    RETURNING id;`;
  const result = (await db.execute(statement))[0] as { id: string } | undefined;
  return result;
}

export async function getWorkflows({
  workspaceId,
}: {
  workspaceId: string;
}): Promise<Workflow[]> {
  const result = await db
    .select()
    .from(workflows)
    .where(eq(workflows.workspaceId, workspaceId));
  return result;
}

export async function getWorkflowById({
  id,
}: {
  id: string;
}): Promise<Workflow | undefined> {
  const result = (
    await db.select().from(workflows).where(eq(workflows.id, id))
  )[0];
  return result;
}
