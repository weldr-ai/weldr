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

export const declarationSpecsV1Schema = z
  .discriminatedUnion("type", [
    endpointSchema.describe("A REST/RPC API endpoint"),
    functionSchema,
    modelSchema.describe("A database model"),
    componentSchema.describe("A UI component like a page, layout, etc."),
    otherSchema.describe(
      "Any other declaration like a type, validation schema, etc.",
    ),
  ])
  .describe("The data of the declaration");

export const declarationSpecsSchema = z.discriminatedUnion("version", [
  z.object({
    version: z.literal("v1").describe("MUST always be v1"),
    data: declarationSpecsV1Schema,
  }),
]);
