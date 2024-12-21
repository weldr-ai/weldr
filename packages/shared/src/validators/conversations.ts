import { z } from "zod";
import {
  databaseColumnReferenceSchema,
  databaseTableReferenceSchema,
  functionReferenceSchema,
  rawContentReferenceElementSchema,
  rawContentTextElementSchema,
  resourceReferenceSchema,
} from "./common";

export const userMessageRawContentReferenceElementSchema = z.discriminatedUnion(
  "referenceType",
  [
    z.object({
      type: z.literal("reference"),
      referenceType: z.literal("function"),
      ...functionReferenceSchema.shape,
    }),
    z.object({
      type: z.literal("reference"),
      referenceType: z.literal("resource"),
      ...resourceReferenceSchema.shape,
    }),
    z.object({
      type: z.literal("reference"),
      referenceType: z.literal("database-table"),
      ...databaseTableReferenceSchema.shape,
    }),
    z.object({
      type: z.literal("reference"),
      referenceType: z.literal("database-column"),
      ...databaseColumnReferenceSchema.shape,
    }),
  ],
);

export const userMessageRawContentElementSchema = z.union([
  rawContentTextElementSchema,
  userMessageRawContentReferenceElementSchema,
]);

export const userMessageRawContentSchema =
  userMessageRawContentElementSchema.array();

export const assistantMessageRawContentReferenceElementSchema =
  rawContentReferenceElementSchema;

export const assistantMessageRawContentElementSchema = z.union([
  rawContentTextElementSchema,
  assistantMessageRawContentReferenceElementSchema,
]);

export const assistantMessageRawContentSchema =
  assistantMessageRawContentElementSchema.array();

export const messageRawContentSchema = z
  .union([
    userMessageRawContentElementSchema,
    assistantMessageRawContentElementSchema,
  ])
  .array();

export const conversationMessageSchema = z.object({
  id: z.string().optional(),
  role: z.enum(["user", "assistant"]),
  content: z.string().optional(),
  rawContent: messageRawContentSchema,
  createdAt: z.date().optional(),
});

export const conversationSchema = z.object({
  id: z.string(),
  createdAt: z.date(),
  messages: conversationMessageSchema.array(),
});
