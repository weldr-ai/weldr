import type { z } from "zod";
import type {
  dataTypeSchema,
  inputSchema,
  jsonSchemaPropertySchema,
  outputSchema,
  packageSchema,
  primitiveRequirementsMessageSchema,
  rawContentSchema,
} from "../validators/common";
import type {
  assistantMessageRawContentSchema,
  conversationMessageSchema,
  conversationSchema,
  messageRawContentSchema,
  userMessageRawContentSchema,
} from "../validators/conversations";
import type {
  endpointFlowMetadataSchema,
  endpointFlowSchema,
  flowSchema,
  flowTypesSchema,
  taskFlowMetadataSchema,
  taskFlowSchema,
  utilityFlowMetadataSchema,
} from "../validators/flows";
import type {
  integrationSchema,
  integrationTypeSchema,
  integrationUtilitySchema,
} from "../validators/integrations";
import type {
  dependencySchema,
  primitiveSchema,
  testRunSchema,
} from "../validators/primitives";
import type { resourceSchema } from "../validators/resources";
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
}

export type InputSchema = z.infer<typeof inputSchema>;
export type OutputSchema = z.infer<typeof outputSchema>;

export type Workspace = z.infer<typeof workspaceSchema>;

export type EndpointFlowMetadata = z.infer<typeof endpointFlowMetadataSchema>;
export type TaskFlowMetadata = z.infer<typeof taskFlowMetadataSchema>;
export type UtilityFlowMetadata = z.infer<typeof utilityFlowMetadataSchema>;

export type EndpointFlow = z.infer<typeof endpointFlowSchema>;
export type TaskFlow = z.infer<typeof taskFlowSchema>;

export type FlowType = z.infer<typeof flowTypesSchema>;
export type Flow = z.infer<typeof flowSchema>;
export type FlowMetadata =
  | UtilityFlowMetadata
  | EndpointFlowMetadata
  | TaskFlowMetadata;

export type UserMessageRawContent = z.infer<typeof userMessageRawContentSchema>;
export type AssistantMessageRawContent = z.infer<
  typeof assistantMessageRawContentSchema
>;
export type MessageRawContent = z.infer<typeof messageRawContentSchema>;
export type ConversationMessage = z.infer<typeof conversationMessageSchema>;
export type Conversation = z.infer<typeof conversationSchema>;

export type Resource = z.infer<typeof resourceSchema>;

export type Integration = z.infer<typeof integrationSchema>;
export type IntegrationType = z.infer<typeof integrationTypeSchema>;
export type IntegrationUtility = z.infer<typeof integrationUtilitySchema>;

export type RawContent = z.infer<typeof rawContentSchema>;
export type Package = z.infer<typeof packageSchema>;
export type Dependency = z.infer<typeof dependencySchema>;
export type Primitive = z.infer<typeof primitiveSchema>;
export type TestRun = z.infer<typeof testRunSchema>;

export type PrimitiveRequirementsMessage = z.infer<
  typeof primitiveRequirementsMessageSchema
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
