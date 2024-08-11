import express from "express";

import type {
  FunctionPrimitive,
  Primitive,
  Resource,
  RouteMetadata,
} from "@integramind/shared/types";

import { generateCode } from "@integramind/ai";
import { and, db, eq, sql } from "@integramind/db";
import { flows, primitives, resources } from "@integramind/db/schema";
import { executePrimitive } from "~/lib/executor";
import {
  getExecutionOrder,
  getResourceInfo,
  getSystemMessage,
  getUserMessage,
  toCamelCase,
} from "../lib/utils";

const router = express.Router();

router.use("/primitives/:primitiveId", async (req, res) => {
  const { primitiveId } = req.params;

  const primitive = (await db.query.primitives.findFirst({
    where: eq(primitives.id, primitiveId),
  })) as FunctionPrimitive;

  if (!primitive || primitive.type !== "function") {
    return res.status(404).json({ error: "Function not found" });
  }

  const inputs: Record<string, string | number> = {};

  for (const input of primitive.metadata.inputs ?? []) {
    if (input.testValue) {
      inputs[toCamelCase(input.name)] = input.testValue;
    }
  }

  let resource: Resource | undefined;

  if (primitive.metadata.resource) {
    resource = await db.query.resources.findFirst({
      where: eq(resources.id, primitive.metadata.resource.id),
    });
  }

  const code = primitive.metadata.generatedCode;

  if (
    primitive.description &&
    !primitive.metadata.isLocked &&
    !primitive.metadata.isCodeUpdated
  ) {
    let resourceInfo:
      | { actions: string[]; getInfo: (auth: unknown) => Promise<unknown> }
      | undefined;

    if (resource) {
      resourceInfo = await getResourceInfo(resource.provider);
    }

    if (!resourceInfo) {
      return res.status(500).json({ error: "Server error" });
    }

    const systemMessage = getSystemMessage(resource !== undefined);
    const userMessage = getUserMessage({
      resourceInfo: resource
        ? {
            name: resource.name,
            type: resource.provider,
            actions: resourceInfo?.actions ?? [],
            metadata:
              resource.provider === "postgres"
                ? JSON.stringify(
                    await resourceInfo.getInfo({ auth: resource.metadata }),
                  )
                : undefined,
          }
        : undefined,
      functionsToImplement: [toCamelCase(primitive.name)],
      functionality: primitive.description,
    });

    const functionCode = await generateCode(systemMessage, userMessage);

    await db
      .update(primitives)
      .set({
        metadata: {
          ...primitive.metadata,
          type: "function",
          generatedCode: functionCode,
          isCodeUpdated: true,
        },
      })
      .where(eq(primitives.id, primitive.id));
  }

  if (!code) {
    return res.status(500).json({ error: "Server error" });
  }

  const resourcesInfo = resource
    ? [
        {
          [resource.provider]: {
            auth: {
              ...resource.metadata,
            },
          },
        },
      ]
    : [];

  const executionResult = await executePrimitive(
    primitive.name,
    code,
    resourcesInfo,
    inputs,
  );

  const result = Array.isArray(executionResult)
    ? [...(executionResult as unknown[])]
    : [executionResult];

  console.log(result);

  res.status(200).json({ result });
});

router.use("/:workspaceId/*", async (req, res) => {
  const workspaceId = req.params.workspaceId;

  const baseRoute = `/api/engine/${workspaceId}`;
  const path = req.originalUrl.slice(baseRoute.length);

  const method = req.method as "GET" | "POST" | "PUT" | "DELETE";

  const result = await db
    .select({
      metadata: primitives.metadata,
      flowId: primitives.flowId,
    })
    .from(primitives)
    .where(
      and(
        eq(primitives.type, "route"),
        sql`primitives.metadata::jsonb->>'path' = ${path}`,
      ),
    );

  if (!result[0]) {
    return res.status(404).json({ error: "Route not found" });
  }

  const flow = await db.query.flows.findFirst({
    where: eq(flows.id, result[0].flowId),
    with: {
      primitives: true,
      edges: true,
    },
  });

  if (!flow) {
    return res.status(404).json({ error: "Flow not found" });
  }

  const route = {
    flow,
    config: {
      method: (result[0].metadata as RouteMetadata).method,
      path: (result[0].metadata as RouteMetadata).path,
      inputs: (result[0].metadata as RouteMetadata).inputs,
    },
  };

  if (!route) {
    return res.status(404).send("Not found");
  }

  if (method.toLowerCase() !== route.config.path.toLowerCase()) {
    return res.status(405).send("Method not allowed");
  }

  const executionOrder = getExecutionOrder(
    route.flow.primitives as Primitive[],
    route.flow.edges,
  );

  return res.status(200).json(executionOrder);
});

export default router;
