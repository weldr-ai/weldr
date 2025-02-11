import { z } from "zod";
import {
  databaseColumnReferenceSchema,
  databaseTableReferenceSchema,
  functionReferenceSchema,
  rawContentParagraphElementSchema,
  rawContentReferenceElementSchema,
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
  rawContentParagraphElementSchema,
  userMessageRawContentReferenceElementSchema,
]);

export const userMessageRawContentSchema =
  userMessageRawContentElementSchema.array();

export const assistantMessageRawContentReferenceElementSchema =
  rawContentReferenceElementSchema;

export const assistantMessageRawContentElementSchema = z.union([
  rawContentParagraphElementSchema,
  assistantMessageRawContentReferenceElementSchema,
]);

export const assistantMessageRawContentSchema =
  assistantMessageRawContentElementSchema.array();

export const testExecutionMessageRawContentSchema = z.object({
  stdin: z.string().nullable(),
  stdout: z.string().nullable(),
  stderr: z.string().nullable(),
});

export const messageRawContentSchema = z.union([
  userMessageRawContentElementSchema.array(),
  assistantMessageRawContentElementSchema.array(),
  testExecutionMessageRawContentSchema,
]);

export const attachmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  key: z.string(),
  contentType: z.string(),
  size: z.number(),
  url: z.string().optional(),
});

export const chatMessageSchema = z.object({
  id: z.string().optional(),
  role: z.enum(["user", "assistant"]),
  content: z.string().optional(),
  rawContent: messageRawContentSchema,
  createdAt: z.date().optional(),
  version: z
    .object({
      id: z.string(),
      versionName: z.string(),
      versionNumber: z.number(),
    })
    .optional(),
  attachments: attachmentSchema.array().optional(),
  userId: z.string().optional(),
  user: z
    .object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
      image: z.string().optional(),
    })
    .optional(),
});

export const chatSchema = z.object({
  id: z.string(),
  createdAt: z.date(),
  messages: chatMessageSchema.array(),
});
