import { z } from "zod";

export const packageSchema = z.object({
  type: z.enum(["runtime", "development"]),
  name: z.string().describe("The name of the npm package"),
  version: z.string().optional().describe("The version of the npm package"),
  reason: z.string().describe("The reason for the npm package"),
});

export const rawContentParagraphElementSchema = z.object({
  type: z.literal("paragraph"),
  value: z
    .string()
    .describe("The value of the text. Should be valid markdown."),
});

const baseRawContentReferenceElementSchema = z.object({
  type: z.literal("reference"),
  id: z.string().describe("The ID of the reference"),
  name: z.string().describe("The name of the reference"),
});

export const rawContentReferenceElementSchema = z.discriminatedUnion(
  "referenceType",
  [
    baseRawContentReferenceElementSchema.extend({
      referenceType: z.literal("function"),
    }),
    baseRawContentReferenceElementSchema.extend({
      referenceType: z.literal("model"),
    }),
    baseRawContentReferenceElementSchema.extend({
      referenceType: z.literal("component"),
      subtype: z.enum(["page", "reusable"]),
    }),
    baseRawContentReferenceElementSchema.extend({
      referenceType: z.literal("endpoint"),
      subtype: z.enum(["rest", "rpc"]),
    }),
  ],
);

export const rawContentSchema = z
  .union([rawContentParagraphElementSchema, rawContentReferenceElementSchema])
  .array();
