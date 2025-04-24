import { z } from "zod";
import { componentSchema } from "./component";
import { endpointSchema } from "./endpoint";
import { functionSchema } from "./function";
import { modelSchema } from "./model";
import { otherSchema } from "./other";

export const declarationTypeSchema = z.enum([
  "endpoint",
  "function",
  "model",
  "component",
  "other",
]);

export const declarationSpecsV1Schema = z.object({
  version: z.literal("v1").describe("MUST always be v1"),
  data: z.discriminatedUnion("type", [
    endpointSchema.describe("A REST/RPC API endpoint"),
    functionSchema,
    modelSchema.describe("A database model"),
    componentSchema.describe("A UI component like a page, layout, etc."),
    otherSchema.describe(
      "Any other declaration like a type, validation schema, etc.",
    ),
  ]),
  isNode: z.boolean().describe(
    `Whether the declaration is a node.
- What are the nodes?
- All endpoints and pages are nodes by default.
- UI components are nodes.
- All models are nodes.
- Functions that are DIRECTLY part of the business logic are nodes.`,
  ),
});

export const declarationSpecsSchema = z.discriminatedUnion("version", [
  declarationSpecsV1Schema,
]);
