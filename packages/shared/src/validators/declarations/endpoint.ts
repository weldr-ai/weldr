import { z } from "zod";
import { openApiEndpointSpecSchema } from "../openapi";
import { functionSchema } from "./function";

export const restEndpointSchema = openApiEndpointSpecSchema.extend({
  subtype: z.literal("rest"),
});

export const rpcEndpointSchema = functionSchema
  .omit({
    type: true,
  })
  .extend({
    subtype: z.literal("rpc"),
  });

export const endpointSchema = z.object({
  type: z.literal("endpoint"),
  definition: z.discriminatedUnion("subtype", [
    restEndpointSchema,
    rpcEndpointSchema,
  ]),
});
