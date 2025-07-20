import { experimental_SmartCoercionPlugin as SmartCoercionPlugin } from "@orpc/json-schema";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { RPCHandler } from "@orpc/server/fetch";
import { BatchHandlerPlugin, CORSPlugin } from "@orpc/server/plugins";
import { ZodSmartCoercionPlugin, ZodToJsonSchemaConverter } from "@orpc/zod";

import { router } from "@repo/server/router";

export const openApiHandlerOptions = {
  plugins: [
    new CORSPlugin({
      origin: process.env.CORS_ORIGIN?.split(","),
      allowHeaders: ["Content-Type", "Authorization"],
      allowMethods: ["POST", "GET", "PUT", "DELETE", "OPTIONS"],
      exposeHeaders: ["Content-Length"],
      maxAge: 600,
      credentials: true,
    }),
    new SmartCoercionPlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
    }),
    new OpenAPIReferencePlugin({
      docsPath: "/api/reference",
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "API Reference",
          version: "1.0.0",
        },
      },
    }),
  ],
};

export const openApiHandler = new OpenAPIHandler(router, openApiHandlerOptions);

export const rpcHandler = new RPCHandler(router, {
  plugins: [new ZodSmartCoercionPlugin(), new BatchHandlerPlugin()],
});
