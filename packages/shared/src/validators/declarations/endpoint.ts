import { z } from "zod";
import { openApiEndpointSpecSchema } from "../openapi";

export const endpointSchema = z.object({
  type: z.literal("endpoint"),
  name: z.string().describe("The name of the endpoint."),
  protected: z
    .boolean()
    .optional()
    .describe("Whether the endpoint is protected"),
  definition: openApiEndpointSpecSchema,
});
