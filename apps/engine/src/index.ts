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
import { executeCode } from "./utils";

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
  "/",
  defineEventHandler(async (event) => {
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
    } = body.data;

    const output = await executeCode({
      code,
      functionName,
      functionArgs: functionArgs as { name: string; value: unknown },
      utilities,
      dependencies,
      hasInput,
    });

    return { output };
  }),
);

createServer(toNodeListener(app)).listen(
  `${Number(process.env.ENGINE_PORT ?? 3000)}`,
);
console.log(`Server running on port ${process.env.ENGINE_PORT ?? 3000}`);
