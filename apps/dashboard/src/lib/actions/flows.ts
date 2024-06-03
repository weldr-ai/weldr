"use server";

import type { z } from "zod";

import { and, db, eq, sql } from "@integramind/db";
import { flows, insertFlowSchema } from "@integramind/db/schema";

import type { Flow, FlowType, PrimitiveType } from "~/types";
import { getWorkspaceById } from "~/lib/actions/workspaces";

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

      const id = crypto.randomUUID();

      const getInitialPrimitive = () => {
        switch (validation.data.type) {
          case "route":
            return {
              id,
              name: validation.data.name,
              description: validation.data.description,
              type: validation.data.type,
              actionType: validation.data.actionType,
              urlPath: validation.data.urlPath,
            };
          case "workflow":
            return {
              id,
              name: validation.data.name,
              description: validation.data.description,
              type: validation.data.type,
              triggerType: validation.data.triggerType,
            };
        }
      };

      const statement = sql`
        INSERT INTO ${flows} (id, name, description, workspace_id, type, primitives)
        VALUES (
          ${id},
          ${validation.data.name},
          ${validation.data.description},
          ${validation.data.workspaceId},
          ${validation.data.type},
          '[]'::jsonb || ${getInitialPrimitive()}::jsonb
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
  type,
}: {
  id: string;
  type: FlowType;
}): Promise<Flow | undefined> {
  const result = (
    await db
      .select()
      .from(flows)
      .where(and(eq(flows.id, id), eq(flows.type, type)))
  )[0];
  return result;
}

export async function addFlowPrimitive({
  id,
  primitiveMetadata,
}: {
  id: string;
  primitiveMetadata: { id: string; type: PrimitiveType; name: string };
}): Promise<{ id: string } | undefined> {
  const getPrimitiveMetadata = () => {
    switch (primitiveMetadata.type) {
      case "function":
        return {
          id: primitiveMetadata.id,
          type: primitiveMetadata.type,
          name: primitiveMetadata.name,
          description: "",
          inputs: [],
          outputs: [],
          generatedCode: "",
          isCodeUpdated: false,
        };
    }
  };
  const statement = sql`
    UPDATE ${flows}
    SET primitives = primitives || ${getPrimitiveMetadata()}::jsonb
    WHERE id = ${id}
    RETURNING id;`;
  const result = (await db.execute(statement))[0] as { id: string } | undefined;
  return result;
}

export async function addFlowEdge({
  id,
  edgeMetadata,
}: {
  id: string;
  edgeMetadata: { id: string; source: string; target: string };
}): Promise<{ id: string } | undefined> {
  const statement = sql`
    UPDATE ${flows}
    SET edges = edges || ${{
      id: edgeMetadata.id,
      source: edgeMetadata.source,
      target: edgeMetadata.target,
    }}::jsonb
    WHERE id = ${id}
    RETURNING id;`;
  const result = (await db.execute(statement))[0] as { id: string } | undefined;
  return result;
}
