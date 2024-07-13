import express from "express";

import { getRouteFlowByPath } from "@integramind/db/queries";

import { initCodeSandbox } from "../lib/executor";
import { checkMethod, getExecutionOrder } from "../lib/utils";

const router = express.Router();

router.get("/primitives/:primitiveId", async (_req, res) => {
  const codeSandbox = await initCodeSandbox();
  const result = await codeSandbox.runScript({
    script: `
      const code = async (inputs) => {
        return {
          x: inputs.x,
          y: inputs.y,
        };
      };
      code(inputs);
    `,
    scriptContext: {
      inputs: {
        x: 10,
        y: 20,
      },
    },
  });

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
