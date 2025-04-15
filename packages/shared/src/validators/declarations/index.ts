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
});

export const declarationSpecsSchema = z.discriminatedUnion("version", [
  declarationSpecsV1Schema,
]);
