import { z } from "zod";
import {
  databaseColumnReferenceSchema,
  databaseReferenceSchema,
  databaseTableReferenceSchema,
  inputReferenceSchema,
  rawContentReferenceElementSchema,
  rawContentTextElementSchema,
  utilityFunctionReferenceSchema,
} from "./common";

export const userMessageRawContentReferenceElementSchema = z.discriminatedUnion(
  "referenceType",
  [
    z.object({
      type: z.literal("reference"),
      referenceType: z.literal("input"),
      ...inputReferenceSchema.shape,
    }),
    z.object({
      type: z.literal("reference"),
      referenceType: z.literal("database"),
      ...databaseReferenceSchema.shape,
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
    z.object({
      type: z.literal("reference"),
      referenceType: z.literal("utility-function"),
      ...utilityFunctionReferenceSchema.shape,
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
  content: z.string(),
  rawContent: messageRawContentSchema,
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export const conversationSchema = z.object({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  messages: conversationMessageSchema.array(),
});
