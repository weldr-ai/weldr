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
  version: z.literal("v1"),
  data: z.discriminatedUnion("type", [
    endpointSchema,
    functionSchema,
    modelSchema,
    componentSchema,
    otherSchema,
  ]),
  isNode: z.boolean().describe(
    `Whether the declaration is a node.
- What are the nodes?
- All endpoints and pages are nodes by default.
- Functions that are DIRECTLY part of the business logic are nodes.
- Reusable UI components that are important, for example, components with effects.
- What are the non-nodes?
- UI Layouts are not nodes.
- Context Providers are not nodes.`,
  ),
});

export const declarationSpecsSchema = z.discriminatedUnion("version", [
  declarationSpecsV1Schema,
]);
