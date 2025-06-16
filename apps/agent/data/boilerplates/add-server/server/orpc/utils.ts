import type { HonoBindings } from "@/lib/context";
import { router } from "@/orpc/router";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { OpenAPIGenerator } from "@orpc/openapi";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { RPCHandler } from "@orpc/server/fetch";
import { BatchHandlerPlugin } from "@orpc/server/plugins";
import { ZodSmartCoercionPlugin, ZodToJsonSchemaConverter } from "@orpc/zod";

const openAPIHandler = new OpenAPIHandler(router, {
  plugins: [new ZodSmartCoercionPlugin()],
});

export const orpcOpenAPIGenerator = new OpenAPIGenerator({
  schemaConverters: [new ZodToJsonSchemaConverter()],
});

const rpcHandler = new RPCHandler(router, {
  plugins: [new ZodSmartCoercionPlugin(), new BatchHandlerPlugin()],
});

export function configureORPC(app: OpenAPIHono<HonoBindings>) {
  app
    .use("/rpc/*", async (c, next) => {
      const rpcResponse = await rpcHandler.handle(c.req.raw, {
        prefix: "/api/rpc",
      });

      if (rpcResponse.matched) {
        return c.newResponse(rpcResponse.response.body, rpcResponse.response);
      }

      await next();
    })
    .use("*", async (c, next) => {
      const openAPIResponse = await openAPIHandler.handle(c.req.raw, {
        prefix: "/api",
      });

      if (openAPIResponse.matched) {
        return c.newResponse(
          openAPIResponse.response.body,
          openAPIResponse.response,
        );
      }

      await next();
    });
}
