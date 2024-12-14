import type { z } from "zod";
import type {
  dataTypeSchema,
  dependencySchema,
  flowInputSchemaMessageSchema,
  flowOutputSchemaMessageSchema,
  funcRequirementsMessageSchema,
  inputSchema,
  jsonSchemaPropertySchema,
  outputSchema,
  rawContentSchema,
} from "../validators/common";
import type {
  assistantMessageRawContentSchema,
  conversationMessageSchema,
  conversationSchema,
  messageRawContentSchema,
  userMessageRawContentSchema,
} from "../validators/conversations";
import type { edgeSchema } from "../validators/edges";
import type { environmentVariableSchema } from "../validators/environment-variables";
import type {
  endpointFlowMetadataSchema,
  endpointFlowSchema,
  flowSchema,
  flowTypesSchema,
  utilityFlowMetadataSchema,
  workflowFlowMetadataSchema,
  workflowFlowSchema,
} from "../validators/flows";
import type { funcSchema } from "../validators/funcs";
import type {
  integrationSchema,
  integrationTypeSchema,
  integrationUtilitySchema,
} from "../validators/integrations";
import type { resourceSchema } from "../validators/resources";
import type { testRunSchema } from "../validators/test-runs";
import type { workspaceSchema } from "../validators/workspaces";

export type DataType = z.infer<typeof dataTypeSchema>;

export type JsonSchemaProperty = z.infer<typeof jsonSchemaPropertySchema>;
export type JsonSchema = JsonSchemaProperty & {
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
};

export interface FlatInputSchema {
  path: string;
  type: DataType;
  required: boolean;
  description?: string;
  refUri: string;
  properties?: Record<string, JsonSchema>;
  itemsType?: JsonSchema;
  sourceFuncId?: string;
}

export type InputSchema = z.infer<typeof inputSchema>;
export type OutputSchema = z.infer<typeof outputSchema>;

export type Workspace = z.infer<typeof workspaceSchema>;

export type EndpointFlowMetadata = z.infer<typeof endpointFlowMetadataSchema>;
export type WorkflowFlowMetadata = z.infer<typeof workflowFlowMetadataSchema>;
export type UtilityFlowMetadata = z.infer<typeof utilityFlowMetadataSchema>;

export type EndpointFlow = z.infer<typeof endpointFlowSchema>;
export type WorkflowFlow = z.infer<typeof workflowFlowSchema>;

export type FlowType = z.infer<typeof flowTypesSchema>;
export type Flow = z.infer<typeof flowSchema>;
export type FlowMetadata =
  | UtilityFlowMetadata
  | EndpointFlowMetadata
  | WorkflowFlowMetadata;
export type FlowEdge = z.infer<typeof edgeSchema>;

export type UserMessageRawContent = z.infer<typeof userMessageRawContentSchema>;
export type AssistantMessageRawContent = z.infer<
  typeof assistantMessageRawContentSchema
>;
export type FlowInputSchemaMessage = z.infer<
  typeof flowInputSchemaMessageSchema
>;
export type FlowOutputSchemaMessage = z.infer<
  typeof flowOutputSchemaMessageSchema
>;
export type MessageRawContent = z.infer<typeof messageRawContentSchema>;
export type ConversationMessage = z.infer<typeof conversationMessageSchema>;
export type Conversation = z.infer<typeof conversationSchema>;

export type Resource = z.infer<typeof resourceSchema>;

export type Integration = z.infer<typeof integrationSchema>;
export type IntegrationType = z.infer<typeof integrationTypeSchema>;
export type IntegrationUtility = z.infer<typeof integrationUtilitySchema>;

export type EnvironmentVariable = z.infer<typeof environmentVariableSchema>;

export type RawContent = z.infer<typeof rawContentSchema>;
export type Dependency = z.infer<typeof dependencySchema>;
export type Func = z.infer<typeof funcSchema>;
export type TestRun = z.infer<typeof testRunSchema>;

export type FuncRequirementsMessage = z.infer<
  typeof funcRequirementsMessageSchema
>;

export type BaseFormState<
  FormFields = Record<string, string>,
  TPayload = unknown,
> =
  | {
      status: "success";
      title?: string;
      payload: TPayload;
      message?: string;
    }
  | {
      status: "validationError";
      title?: string;
      fields: FormFields;
      errors: FormFields;
    }
  | {
      status: "error";
      title?: string;
      fields: FormFields;
      message?: string;
    }
  | undefined;
