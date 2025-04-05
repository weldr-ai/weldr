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

export const declarationSpecsV1Schema = z.discriminatedUnion("type", [
  endpointSchema,
  functionSchema,
  modelSchema,
  componentSchema,
  otherSchema,
]);

export const declarationSpecsSchema = z.discriminatedUnion("version", [
  endpointSchema.extend({
    version: z.literal("v1"),
  }),
  functionSchema.extend({
    version: z.literal("v1"),
  }),
  modelSchema.extend({
    version: z.literal("v1"),
  }),
  componentSchema.extend({
    version: z.literal("v1"),
  }),
  otherSchema.extend({
    version: z.literal("v1"),
  }),
]);
