"use server";

import type { z } from "zod";

import { and, db, eq, sql } from "@integramind/db";
import { flows, insertFlowSchema, primitives } from "@integramind/db/schema";

import type { Edge, Flow, FlowType, Primitive } from "~/types";
import { getWorkspaceById } from "~/lib/queries/workspaces";

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
      const workspace = await getWorkspaceById({
        id: validation.data.workspaceId,
      });

      if (!workspace) {
        return { status: "error", fields };
      }

      const result = (
        await db
          .insert(flows)
          .values({
            name: validation.data.name,
            description: validation.data.description,
            workspaceId: validation.data.workspaceId,
            type: validation.data.type,
          })
          .returning({ id: flows.id })
      )[0];

      if (result) {
        switch (validation.data.type) {
          case "route":
            await db.insert(primitives).values({
              type: "route",
              name: validation.data.name,
              description: validation.data.description,
              metadata: sql`${{
                type: "route",
                actionType: validation.data.actionType,
                urlPath: validation.data.urlPath,
                inputs: [],
              }}::jsonb`,
              flowId: result.id,
            });
            break;
          case "workflow":
            await db.insert(primitives).values({
              type: "workflow",
              name: validation.data.name,
              description: validation.data.description,
              metadata: sql`${{
                type: "workflow",
                triggerType: validation.data.triggerType,
              }}::jsonb`,
              flowId: result.id,
            });
            break;
        }
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

export async function getFlows({
  workspaceId,
  type,
}: {
  workspaceId: string;
  type: FlowType;
}): Promise<Flow[]> {
  const result = await db
    .select()
    .from(flows)
    .where(and(eq(flows.workspaceId, workspaceId), eq(flows.type, type)));
  return result;
}

export async function getFlowById({
  id,
}: {
  id: string;
}): Promise<(Flow & { edges: Edge[]; primitives: Primitive[] }) | undefined> {
  const result = await db.query.flows.findFirst({
    where: and(eq(flows.id, id)),
    with: {
      primitives: true,
      edges: true,
    },
  });
  return result as
    | (Flow & { edges: Edge[]; primitives: Primitive[] })
    | undefined;
}
