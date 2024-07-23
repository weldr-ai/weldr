import express from "express";

import { getRouteFlowByPath } from "@integramind/db/queries/flows";
import {
  getFunctionPrimitiveWithSecretsById,
  updateFunctionPrimitiveById,
} from "@integramind/db/queries/primitives";
import { getResourceById } from "@integramind/db/queries/resources";
import type { Resource } from "@integramind/db/types";

import { executePrimitive } from "~/lib/native-executor";
import { generateCode } from "~/lib/openai";
import {
  checkMethod,
  getExecutionOrder,
  getResourceInfo,
  getSystemMessage,
  getUserMessage,
  toCamelCase,
} from "../lib/utils";

const router = express.Router();

router.use("/primitives/:primitiveId", async (req, res) => {
  const { primitiveId } = req.params;

  const primitive = await getFunctionPrimitiveWithSecretsById({
    id: primitiveId,
  });

  if (!primitive) {
    return res.status(404).json({ error: "Function not found" });
  }

  const inputs: Record<string, string | number> = {};

  for (const input of primitive.inputs) {
    if (input.testValue) {
      inputs[toCamelCase(input.name)] = input.testValue;
    } else {
      return Response.json({ error: "Missing test value" }, { status: 400 });
    }
  }

  let resource: Resource | undefined;

  if (primitive.resource) {
    resource = await getResourceById({
      id: primitive.resource?.id,
    });
  }

  const code = primitive.generatedCode;

  if (
    primitive.description &&
    !primitive.isLocked &&
    !primitive.isCodeUpdated
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

    await updateFunctionPrimitiveById({
      id: primitive.id,
      generatedCode: functionCode,
      isCodeUpdated: true,
    });
  }

  if (!code) {
    return res.status(500).json({ error: "Server error" });
  }

  const resources = resource
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
    resources,
    inputs,
  );

  const result = Array.isArray(executionResult)
    ? [...(executionResult as unknown[])]
    : [executionResult];

  return res.json({ result });
});

router.use("/:workspaceId/*", async (req, res) => {
  const workspaceId = req.params.workspaceId;

  const baseRoute = `/api/engine/${workspaceId}`;
  const path = req.originalUrl.slice(baseRoute.length);

  const method = req.method as "GET" | "POST" | "PUT" | "DELETE";

  const route = await getRouteFlowByPath({
    workspaceId,
    urlPath: path,
  });

  if (!route) {
    return res.status(404).send("Not found");
  }

  if (!checkMethod(method, route.config.actionType)) {
    return res.status(405).send("Method not allowed");
  }

  const executionOrder = getExecutionOrder(
    route.flow.primitives,
    route.flow.edges,
  );

  return res.status(200).json(executionOrder);
});

export default router;
