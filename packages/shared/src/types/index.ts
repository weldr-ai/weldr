import type { JSONSchema7 } from "json-schema";
import type { z } from "zod";
import type { canvasNodeTypeSchema } from "../validators/canvas-node";
import type {
  assistantMessageSchema,
  attachmentSchema,
  chatMessageSchema,
  chatSchema,
  messageRoleSchema,
  toolMessageSchema,
  userMessageSchema,
} from "../validators/chats";
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
import type { endpointSchema } from "../validators/declarations/endpoint";
import type { functionSchema } from "../validators/declarations/function";
import type { modelSchema } from "../validators/declarations/model";
import type { environmentVariableSchema } from "../validators/environment-variables";
import type { dataTypeSchema } from "../validators/json-schema";
import type { openApiEndpointSpecSchema } from "../validators/openapi";
import type { packageSchema } from "../validators/packages";
import type {
  projectConfigSchema,
  projectSchema,
} from "../validators/projects";
import type { themeDataSchema, themeSchema } from "../validators/themes";

export type DataType = z.infer<typeof dataTypeSchema>;

export type OpenApiEndpointSpec = z.infer<typeof openApiEndpointSpecSchema>;
export type JsonSchema = JSONSchema7;

export type Project = z.infer<typeof projectSchema>;
export type ProjectConfig = z.infer<typeof projectConfigSchema>;

export type MessageRole = z.infer<typeof messageRoleSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ChatMessageContent = z.infer<typeof chatMessageSchema>["content"];
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
export type FunctionDeclarationSpecs = z.infer<typeof functionSchema>;
export type ModelDeclarationSpecs = z.infer<typeof modelSchema>;
export type ComponentDeclarationSpecs = z.infer<typeof componentSchema>;
export type PageDeclarationSpecs = z.infer<typeof pageSchema>;
export type LayoutDeclarationSpecs = z.infer<typeof layoutSchema>;
export type ReusableComponentDeclarationSpecs = z.infer<
  typeof reusableComponentSchema
>;

export type EnvironmentVariable = z.infer<typeof environmentVariableSchema>;
export type Package = z.infer<typeof packageSchema>;

export type Theme = z.infer<typeof themeSchema>;
export type ThemeData = z.infer<typeof themeDataSchema>;
export type ThemeMode = keyof Theme;

export type TPendingMessage =
  // Conversation phase - planner acting as interface
  | "thinking" // Processing user request
  | "responding" // Generating response to user
  | "waiting" // Setting up integrations/configurations
  // Workflow execution phase - actual work happening
  | "coding" // Writing/generating code (includes building)
  | "deploying" // Deploying to runtime (includes enriching in parallel)
  | "completing" // Finishing up
  | null;

export type TextStreamableValue = {
  type: "text";
  text: string;
};

export type EndStreamableValue = {
  type: "end";
};

export type ToolStreamableValue = {
  type: "tool";
  toolName: string;
  toolCallId: string;
  toolArgs?: unknown;
  toolResult: unknown;
};

// Workflow streaming types matching database schema
export type WorkflowRunStreamableValue = {
  type: "workflow_run";
  runId: string;
  status: "running" | "completed" | "failed" | "suspended";
  errorMessage?: string;
};

export type WorkflowStepStreamableValue = {
  type: "workflow_step";
  runId: string;
  stepId: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  output?: unknown;
  errorMessage?: string;
};

// Legacy coder type (deprecated, will be replaced by workflow types)
export type CoderStreamableValue =
  | {
      id?: string;
      type: "coder";
      status: "initiated" | "coded" | "enriched" | "succeeded" | "failed";
    }
  | {
      id?: string;
      type: "coder";
      status: "deployed";
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

export type TStreamableValue =
  | TextStreamableValue
  | ToolStreamableValue
  | WorkflowRunStreamableValue
  | WorkflowStepStreamableValue
  | CoderStreamableValue // Legacy - will be removed
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
