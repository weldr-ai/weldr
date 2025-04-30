import type { JSONSchema7 } from "json-schema";
import type { z } from "zod";
import type { canvasNodeTypeSchema } from "../validators/canvas-node";
import type {
  assistantMessageRawContentSchema,
  assistantMessageSchema,
  attachmentSchema,
  chatMessageSchema,
  chatSchema,
  messageRawContentSchema,
  messageRoleSchema,
  toolMessageRawContentSchema,
  toolMessageSchema,
  userMessageRawContentSchema,
  userMessageSchema,
  versionMessageRawContentSchema,
} from "../validators/chats";
import type { packageSchema, rawContentSchema } from "../validators/common";
import type {
  declarationSpecsSchema,
  declarationSpecsV1Schema,
  declarationTypeSchema,
} from "../validators/declarations";
import type {
  componentSchema,
  layoutSchema,
  pageSchema,
  reusableComponentSchema,
} from "../validators/declarations/component";
import type {
  endpointSchema,
  restEndpointSchema,
  rpcEndpointSchema,
} from "../validators/declarations/endpoint";
import type { functionSchema } from "../validators/declarations/function";
import type { modelSchema } from "../validators/declarations/model";
import type { environmentVariableSchema } from "../validators/environment-variables";
import type { dataTypeSchema } from "../validators/json-schema";
import type { openApiEndpointSpecSchema } from "../validators/openapi";
import type { projectSchema } from "../validators/projects";
import type { themeDataSchema, themeSchema } from "../validators/themes";

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
export type MessageRole = z.infer<typeof messageRoleSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type UserMessage = z.infer<typeof userMessageSchema>;
export type AssistantMessage = z.infer<typeof assistantMessageSchema>;
export type ToolMessage = z.infer<typeof toolMessageSchema>;
export type Chat = z.infer<typeof chatSchema>;
export type Attachment = z.infer<typeof attachmentSchema>;

export type CanvasNodeType = z.infer<typeof canvasNodeTypeSchema>;
export type DeclarationType = z.infer<typeof declarationTypeSchema>;
export type DeclarationSpecs = z.infer<typeof declarationSpecsSchema>;
export type DeclarationSpecsV1 = z.infer<typeof declarationSpecsV1Schema>;
export type EndpointDeclarationSpecs = z.infer<typeof endpointSchema>;
export type RestEndpointDeclarationSpecs = z.infer<typeof restEndpointSchema>;
export type RpcEndpointDeclarationSpecs = z.infer<typeof rpcEndpointSchema>;
export type FunctionDeclarationSpecs = z.infer<typeof functionSchema>;
export type ModelDeclarationSpecs = z.infer<typeof modelSchema>;
export type ComponentDeclarationSpecs = z.infer<typeof componentSchema>;
export type PageDeclarationSpecs = z.infer<typeof pageSchema>;
export type LayoutDeclarationSpecs = z.infer<typeof layoutSchema>;
export type ReusableComponentDeclarationSpecs = z.infer<
  typeof reusableComponentSchema
>;

export type EnvironmentVariable = z.infer<typeof environmentVariableSchema>;
export type RawContent = z.infer<typeof rawContentSchema>;
export type Package = z.infer<typeof packageSchema>;

export type Theme = z.infer<typeof themeSchema>;
export type ThemeData = z.infer<typeof themeDataSchema>;
export type ThemeMode = keyof Theme;
