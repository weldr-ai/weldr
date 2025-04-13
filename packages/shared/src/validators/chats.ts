import { z } from "zod";
import {
  databaseColumnReferenceSchema,
  databaseTableReferenceSchema,
  functionReferenceSchema,
  integrationReferenceSchema,
  rawContentParagraphElementSchema,
  rawContentReferenceElementSchema,
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
      referenceType: z.literal("integration"),
      ...integrationReferenceSchema.shape,
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

export const toolMessageRawContentSchema = z.object({
  toolName: z.string(),
  toolArgs: z.record(z.any()).optional(),
  toolResult: z.any().optional(),
});

export const versionMessageRawContentSchema = z.object({
  versionId: z.string(),
  versionMessage: z.string(),
  versionNumber: z.number(),
});

export const messageRawContentSchema = z.union([
  userMessageRawContentElementSchema.array(),
  assistantMessageRawContentElementSchema.array(),
  toolMessageRawContentSchema,
  versionMessageRawContentSchema,
]);

export const attachmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  key: z.string(),
  contentType: z.string(),
  size: z.number(),
  url: z.string().optional(),
});

const baseMessageSchema = z.object({
  id: z.string().optional(),
  createdAt: z.date(),
  chatId: z.string().optional(),
});

export const messageRoleSchema = z.enum([
  "user",
  "assistant",
  "tool",
  "version",
  "code",
]);

export const userMessageSchema = baseMessageSchema.extend({
  role: z.literal("user"),
  rawContent: userMessageRawContentElementSchema.array(),
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

export const assistantMessageSchema = baseMessageSchema.extend({
  role: z.literal("assistant"),
  rawContent: assistantMessageRawContentElementSchema.array(),
  version: z
    .object({
      id: z.string(),
      versionName: z.string(),
      versionNumber: z.number(),
    })
    .optional(),
});

export const toolMessageSchema = baseMessageSchema.extend({
  role: z.literal("tool"),
  rawContent: toolMessageRawContentSchema,
});

export const versionMessageSchema = baseMessageSchema.extend({
  role: z.literal("version"),
  rawContent: versionMessageRawContentSchema,
});

export const chatMessageSchema = z.discriminatedUnion("role", [
  userMessageSchema,
  assistantMessageSchema,
  toolMessageSchema,
  versionMessageSchema,
]);

export const chatSchema = z.object({
  id: z.string(),
  createdAt: z.date(),
  messages: chatMessageSchema.array(),
});

export const addMessageItemSchema = z.discriminatedUnion("role", [
  z.object({
    role: z.literal("assistant"),
    rawContent: assistantMessageRawContentSchema,
    createdAt: z.date().optional(),
  }),
  z.object({
    id: z.string().cuid2(),
    role: z.literal("user"),
    rawContent: userMessageRawContentSchema,
    attachmentIds: z.string().array().optional(),
    createdAt: z.date().optional(),
  }),
  z.object({
    role: z.literal("tool"),
    rawContent: toolMessageRawContentSchema,
    createdAt: z.date().optional(),
  }),
  z.object({
    role: z.literal("version"),
    rawContent: versionMessageRawContentSchema,
    createdAt: z.date().optional(),
  }),
]);

export const addMessagesInputSchema = z.object({
  chatId: z.string(),
  messages: addMessageItemSchema.array(),
});
