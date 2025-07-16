import type { JSONSchema7 } from "json-schema";
import type { z } from "zod";
import type {
  assistantMessageSchema,
  attachmentSchema,
  chatMessageSchema,
  chatSchema,
  messageRoleSchema,
  toolMessageSchema,
  userMessageSchema,
} from "../validators/chats";
import type { environmentVariableSchema } from "../validators/environment-variables";
import type {
  integrationCategorySchema,
  integrationEnvironmentVariableMappingSchema,
  integrationKeySchema,
  integrationSchema,
  integrationTemplateSchema,
  integrationTemplateVariableSchema,
  integrationTemplateWithVariablesSchema,
  variableSourceTypeSchema,
} from "../validators/integrations";
import type { dataTypeSchema } from "../validators/json-schema";
import type { nodeSchema, nodeTypeSchema } from "../validators/nodes";
import type { openApiEndpointSpecSchema } from "../validators/openapi";
import type { packageSchema } from "../validators/packages";
import type {
  declarationTaskSchema,
  genericTaskSchema,
  planSchema,
  taskSchema,
} from "../validators/plans";
import type { projectSchema } from "../validators/projects";
import type { themeDataSchema, themeSchema } from "../validators/themes";
import type { versionSchema } from "../validators/versions";
import type { DeclarationMetadata, DeclarationProgress } from "./declarations";

export type DataType = z.infer<typeof dataTypeSchema>;

export type OpenApiEndpointSpec = z.infer<typeof openApiEndpointSpecSchema>;
export type JsonSchema = JSONSchema7;

export type Project = z.infer<typeof projectSchema>;

export type Version = z.infer<typeof versionSchema>;

export type MessageRole = z.infer<typeof messageRoleSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ChatMessageContent = z.infer<typeof chatMessageSchema>["content"];
export type UserMessage = z.infer<typeof userMessageSchema>;
export type AssistantMessage = z.infer<typeof assistantMessageSchema>;
export type ToolMessage = z.infer<typeof toolMessageSchema>;
export type Chat = z.infer<typeof chatSchema>;
export type Attachment = z.infer<typeof attachmentSchema>;

export type EnvironmentVariable = z.infer<typeof environmentVariableSchema>;
export type Package = z.infer<typeof packageSchema>;

export type NodeType = z.infer<typeof nodeTypeSchema>;
export type Node = z.infer<typeof nodeSchema>;

export type Theme = z.infer<typeof themeSchema>;
export type ThemeData = z.infer<typeof themeDataSchema>;
export type ThemeMode = keyof Theme;

export type Plan = z.infer<typeof planSchema>;
export type Task = z.infer<typeof taskSchema>;
export type GenericTask = z.infer<typeof genericTaskSchema>;
export type DeclarationTask = z.infer<typeof declarationTaskSchema>;

export type TPendingMessage =
  | "thinking"
  | "responding"
  | "waiting"
  | "planning"
  | "coding"
  | "deploying"
  | null;

export type TextStreamableValue = {
  type: "text";
  text: string;
};

export type EndStreamableValue = {
  type: "end";
};

export type NodeStreamableValue = {
  type: "node";
  nodeId: string;
  position: { x: number; y: number };
  metadata: DeclarationMetadata;
  progress: DeclarationProgress;
  node: Node;
};

export type ToolStreamableValue = {
  type: "tool";
  toolName: string;
  toolCallId: string;
  toolArgs?: unknown;
  toolResult: unknown;
};

export type VersionStreamableValue = {
  id?: string;
  createdAt?: Date;
  type: "version";
  versionId: string;
  versionMessage: string;
  versionNumber: number;
  versionDescription: string;
  changedFiles: {
    path: string;
    status: "pending" | "success";
  }[];
};

export type ProjectStreamableValue = {
  type: "update_project";
  data: Partial<Project & { currentVersion: Partial<Version> }>;
};

export type TStreamableValue =
  | TextStreamableValue
  | ToolStreamableValue
  | NodeStreamableValue
  | ProjectStreamableValue
  | EndStreamableValue;

// SSE-specific event types
export type SSEConnectionEvent = {
  type: "connected";
  clientId: string;
  streamId: string;
  workflowRunning?: boolean;
};

export type SSEWorkflowCompleteEvent = {
  type: "workflow_complete";
};

export type SSEErrorEvent = {
  type: "error";
  error: string;
};

export type SSEEvent =
  | SSEConnectionEvent
  | SSEWorkflowCompleteEvent
  | SSEErrorEvent
  | TStreamableValue;

// Trigger API response type
export type TriggerWorkflowResponse = {
  success: boolean;
  streamId: string;
  runId: string;
  message?: string;
};

export type IntegrationCategory = z.infer<typeof integrationCategorySchema>;
export type IntegrationKey = z.infer<typeof integrationKeySchema>;
export type VariableSourceType = z.infer<typeof variableSourceTypeSchema>;
export type IntegrationTemplateVariable = z.infer<
  typeof integrationTemplateVariableSchema
>;
export type IntegrationTemplate = z.infer<typeof integrationTemplateSchema>;
export type IntegrationTemplateWithVariables = z.infer<
  typeof integrationTemplateWithVariablesSchema
>;
export type Integration = z.infer<typeof integrationSchema>;
export type IntegrationEnvironmentVariableMapping = z.infer<
  typeof integrationEnvironmentVariableMappingSchema
>;
