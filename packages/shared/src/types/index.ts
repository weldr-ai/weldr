import type { JSONSchema7 } from "json-schema";
import type { z } from "zod";
import type {
  assistantMessageRawContentSchema,
  assistantMessageSchema,
  attachmentSchema,
  chatMessageSchema,
  chatSchema,
  messageRawContentSchema,
  toolMessageRawContentSchema,
  toolMessageSchema,
  userMessageRawContentSchema,
  userMessageSchema,
  versionMessageRawContentSchema,
} from "../validators/chats";
import type { packageSchema, rawContentSchema } from "../validators/common";
import type { declarationMetadataSchema } from "../validators/declarations";
import type { environmentVariableSchema } from "../validators/environment-variables";
import type { dataTypeSchema } from "../validators/json-schema";
import type { openApiEndpointSpecSchema } from "../validators/openapi";
import type { projectSchema } from "../validators/projects";

export type DataType = z.infer<typeof dataTypeSchema>;

export type OpenApiEndpointSpec = z.infer<typeof openApiEndpointSpecSchema>;
export type JsonSchema = JSONSchema7;

export type Project = z.infer<typeof projectSchema>;

export type UserMessageRawContent = z.infer<typeof userMessageRawContentSchema>;
export type AssistantMessageRawContent = z.infer<
  typeof assistantMessageRawContentSchema
>;
export type MessageRawContent = z.infer<typeof messageRawContentSchema>;
export type ToolMessageRawContent = z.infer<typeof toolMessageRawContentSchema>;
export type VersionMessageRawContent = z.infer<
  typeof versionMessageRawContentSchema
>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type UserMessage = z.infer<typeof userMessageSchema>;
export type AssistantMessage = z.infer<typeof assistantMessageSchema>;
export type ToolMessage = z.infer<typeof toolMessageSchema>;
export type Chat = z.infer<typeof chatSchema>;
export type Attachment = z.infer<typeof attachmentSchema>;

export type DeclarationType =
  | "function"
  | "component"
  | "endpoint"
  | "model"
  | "other";
export type DeclarationMetadata = z.infer<typeof declarationMetadataSchema>;

export type EnvironmentVariable = z.infer<typeof environmentVariableSchema>;

export type RawContent = z.infer<typeof rawContentSchema>;
export type Package = z.infer<typeof packageSchema>;
