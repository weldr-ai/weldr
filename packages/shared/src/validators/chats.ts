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

export const dbModelReferencePartSchema = z.object({
  type: z.literal("reference:db-model"),
  id: z.string().describe("The ID of the db model"),
  name: z.string().describe("The name of the db model"),
});

export const pageReferencePartSchema = z.object({
  type: z.literal("reference:page"),
  id: z.string().describe("The ID of the page"),
  name: z.string().describe("The name of the page"),
});

export const endpointReferencePartSchema = z.object({
  type: z.literal("reference:endpoint"),
  id: z.string().describe("The ID of the endpoint"),
  method: z.string().describe("The method of the endpoint"),
  path: z.string().describe("The path of the endpoint"),
});

export const referencePartSchema = z.discriminatedUnion("type", [
  endpointReferencePartSchema,
  dbModelReferencePartSchema,
  pageReferencePartSchema,
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
  dbModelReferencePartSchema,
  pageReferencePartSchema,
  endpointReferencePartSchema,
]);

export const assistantMessageContentSchema = z.discriminatedUnion("type", [
  textPartSchema,
  reasoningPartSchema,
  redactedReasoningPartSchema,
  toolCallPartSchema,
]);

// ===========================================================================
// AI Metadata Schemas
// ===========================================================================

export const baseAiMetadataSchema = z.object({
  inputTokens: z.number(),
  outputTokens: z.number(),
  totalTokens: z.number(),
  inputCost: z.number(),
  outputCost: z.number(),
  totalCost: z.number(),
  inputTokensPrice: z.number(),
  outputTokensPrice: z.number(),
  inputImagesPrice: z.number().nullable(),
  finishReason: z.enum([
    "stop",
    "length",
    "content-filter",
    "tool-calls",
    "error",
    "other",
    "unknown",
  ]),
});

export const aiMetadataSchema = z.discriminatedUnion("provider", [
  baseAiMetadataSchema.extend({
    provider: z.literal("google"),
    model: z.enum(["gemini-2.5-pro", "gemini-2.5-flash"]),
  }),
  baseAiMetadataSchema.extend({
    provider: z.literal("openai"),
    model: z.enum(["gpt-4.1", "gpt-image-1"]),
  }),
  baseAiMetadataSchema.extend({
    provider: z.literal("anthropic"),
    model: z.enum(["claude-sonnet-4", "claude-opus-4"]),
  }),
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
  metadata: aiMetadataSchema.optional(),
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
    metadata: aiMetadataSchema,
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
