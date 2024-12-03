import { createServer } from "node:http";
import {
  createApp,
  createRouter,
  defineEventHandler,
  readValidatedBody,
  setResponseStatus,
  toNodeListener,
} from "h3";
import { z } from "zod";
import { executeEndpoint } from "./lib/endpoints-executor";
import { executeFunction } from "./lib/functions-executor";

export interface Utility {
  filePath: string;
  content: string;
}

export interface Dependency {
  name: string;
  version?: string;
}

export const app = createApp();
const router = createRouter();

app.use(router);

router.get(
  "/health",
  defineEventHandler(() => {
    return { message: "OK" };
  }),
);

router.post(
  "/execute/function",
  defineEventHandler(async (event) => {
    if (event.headers.get("content-type") !== "application/json") {
      setResponseStatus(event, 415);
      return { message: "Content-Type must be application/json" };
    }

    const validationSchema = z.object({
      code: z.string(),
      functionName: z.string(),
      hasInput: z.boolean().default(false),
      functionArgs: z
        .union([z.null(), z.undefined(), z.record(z.string(), z.unknown())])
        .optional(),
      dependencies: z
        .object({
          name: z.string(),
          version: z.string().optional(),
        })
        .array()
        .optional(),
      utilities: z
        .object({
          filePath: z.string(),
          content: z.string(),
        })
        .array()
        .optional(),
      environmentVariablesMap: z.record(z.string(), z.string()).optional(),
      testEnv: z
        .object({ key: z.string(), value: z.string() })
        .array()
        .optional(),
    });

    const body = await readValidatedBody(event, validationSchema.safeParse);

    if (body.error) {
      setResponseStatus(event, 400);
      return { message: "Invalid request body" };
    }

    const {
      code,
      functionName,
      functionArgs,
      hasInput,
      dependencies,
      utilities,
      environmentVariablesMap,
      testEnv,
    } = body.data;

    const output = await executeFunction({
      code,
      functionName,
      functionArgs: functionArgs as { name: string; value: unknown },
      utilities,
      dependencies,
      hasInput,
      environmentVariablesMap,
      testEnv,
    });

    return { output };
  }),
);

router.post(
  "/execute/endpoint",
  defineEventHandler(async (event) => {
    if (event.headers.get("content-type") !== "application/json") {
      setResponseStatus(event, 415);
      return { message: "Content-Type must be application/json" };
    }

    const mockRequestSchema = z.object({
      method: z.string(),
      url: z.string(),
      body: z.unknown().optional(),
      query: z.record(z.string(), z.string()).optional(),
      params: z.record(z.string(), z.string()).optional(),
      headers: z.record(z.string(), z.string()).optional(),
    });

    const validationSchema = z.object({
      code: z.string(),
      request: mockRequestSchema,
      dependencies: z
        .object({
          name: z.string(),
          version: z.string().optional(),
        })
        .array()
        .optional(),
      utilities: z
        .object({
          filePath: z.string(),
          content: z.string(),
        })
        .array()
        .optional(),
      environmentVariablesMap: z.record(z.string(), z.string()).optional(),
      testEnv: z
        .object({ key: z.string(), value: z.string() })
        .array()
        .optional(),
    });

    const body = await readValidatedBody(event, validationSchema.safeParse);

    if (body.error) {
      setResponseStatus(event, 400);
      return { message: "Invalid request body" };
    }

    const {
      code,
      request,
      utilities,
      dependencies,
      environmentVariablesMap,
      testEnv,
    } = body.data;

    const output = await executeEndpoint({
      code,
      request,
      utilities,
      dependencies,
      environmentVariablesMap,
      testEnv,
    });

    return { output };
  }),
);

createServer(toNodeListener(app)).listen(
  `${Number(process.env.ENGINE_PORT ?? 3000)}`,
);
console.log(`Server running on port ${process.env.ENGINE_PORT ?? 3000}`);
