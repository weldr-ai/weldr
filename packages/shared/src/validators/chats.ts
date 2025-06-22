import { z } from "zod";

// ===========================================================================
// Message Parts
// ===========================================================================

export const textPartSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
});

export const imagePartSchema = z.object({
  type: z.literal("image"),
  image: z
    .string()
    .describe("Base64 encoded content, base64 data URL, or http(s) URL"),
  mimeType: z.string().optional(),
});

export const filePartSchema = z.object({
  type: z.literal("file"),
  data: z
    .string()
    .describe("Base64 encoded content, base64 data URL, or http(s) URL"),
  mimeType: z.string(),
});

export const functionReferencePartSchema = z.object({
  type: z.literal("reference:function"),
  id: z.string().describe("The ID of the function"),
  name: z.string().describe("The name of the function"),
});

export const modelReferencePartSchema = z.object({
  type: z.literal("reference:model"),
  id: z.string().describe("The ID of the model"),
  name: z.string().describe("The name of the model"),
});

export const componentReferencePartSchema = z.object({
  type: z.literal("reference:component"),
  id: z.string().describe("The ID of the component"),
  name: z.string().describe("The name of the component"),
  subtype: z.enum(["page", "reusable"]),
});

export const endpointReferencePartSchema = z.object({
  type: z.literal("reference:endpoint"),
  id: z.string().describe("The ID of the endpoint"),
  name: z.string().describe("The name of the endpoint"),
});

export const referencePartSchema = z.discriminatedUnion("type", [
  functionReferencePartSchema,
  modelReferencePartSchema,
  componentReferencePartSchema,
  endpointReferencePartSchema,
]);

export const reasoningPartSchema = z.object({
  type: z.literal("reasoning"),
  text: z.string(),
  signature: z.string().optional(),
});

export const redactedReasoningPartSchema = z.object({
  type: z.literal("redacted-reasoning"),
  data: z.string(),
});

export const toolCallPartSchema = z.object({
  type: z.literal("tool-call"),
  toolCallId: z.string(),
  toolName: z.string(),
  args: z.record(z.unknown()),
});

export const toolResultPartSchema = z.object({
  type: z.literal("tool-result"),
  toolCallId: z.string(),
  toolName: z.string(),
  result: z.unknown(),
  isError: z.boolean().optional(),
});

// ===========================================================================
// Message Content Schemas
// ===========================================================================

export const userMessageContentSchema = z.discriminatedUnion("type", [
  textPartSchema,
  imagePartSchema,
  filePartSchema,
  functionReferencePartSchema,
  modelReferencePartSchema,
  componentReferencePartSchema,
  endpointReferencePartSchema,
]);

export const assistantMessageContentSchema = z.discriminatedUnion("type", [
  textPartSchema,
  reasoningPartSchema,
  redactedReasoningPartSchema,
  toolCallPartSchema,
]);

// ===========================================================================
// Core Message Schemas
// ===========================================================================

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
  visibility: z.enum(["public", "internal"]),
  createdAt: z.date(),
  chatId: z.string().optional(),
});

export const messageRoleSchema = z.enum(["user", "assistant", "tool"]);

export const userMessageSchema = baseMessageSchema.extend({
  role: z.literal("user"),
  content: userMessageContentSchema.array(),
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
  content: assistantMessageContentSchema.array(),
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
  content: toolResultPartSchema.array(),
});

export const chatMessageSchema = z.discriminatedUnion("role", [
  userMessageSchema,
  assistantMessageSchema,
  toolMessageSchema,
]);

export const chatSchema = z.object({
  id: z.string(),
  createdAt: z.date(),
  messages: chatMessageSchema.array(),
});

export const addMessageItemSchema = z.discriminatedUnion("role", [
  z.object({
    visibility: z.enum(["public", "internal"]),
    role: z.literal("assistant"),
    content: assistantMessageContentSchema.array(),
    createdAt: z.date().optional(),
  }),
  z.object({
    visibility: z.enum(["public", "internal"]),
    role: z.literal("user"),
    content: userMessageContentSchema.array(),
    attachmentIds: z.string().array().optional(),
    createdAt: z.date().optional(),
  }),
  z.object({
    visibility: z.enum(["public", "internal"]),
    role: z.literal("tool"),
    content: toolResultPartSchema.array(),
    createdAt: z.date().optional(),
  }),
]);

export const addMessagesInputSchema = z.object({
  chatId: z.string(),
  messages: addMessageItemSchema.array(),
});
