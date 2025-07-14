import { OpenAPIGenerator } from "@orpc/openapi";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { RPCHandler } from "@orpc/server/fetch";
import { BatchHandlerPlugin } from "@orpc/server/plugins";
import { ZodSmartCoercionPlugin, ZodToJsonSchemaConverter } from "@orpc/zod";
import { router } from "./router";

export const openAPIHandler = new OpenAPIHandler(router, {
	plugins: [new ZodSmartCoercionPlugin()],
});

export const orpcOpenAPIGenerator = new OpenAPIGenerator({
	schemaConverters: [new ZodToJsonSchemaConverter()],
});

export const rpcHandler = new RPCHandler(router, {
	plugins: [new ZodSmartCoercionPlugin(), new BatchHandlerPlugin()],
});
