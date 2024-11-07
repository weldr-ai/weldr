import type { z } from "zod";
import type {
  baseJsonSchema,
  dataTypeSchema,
  flowInputSchemaMessageSchema,
  flowOutputSchemaMessageSchema,
  functionRequirementsMessageSchema,
  inputSchema,
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
import type {
  componentFlowSchema,
  endpointFlowMetadataSchema,
  endpointFlowSchema,
  flowSchema,
  flowTypesSchema,
  taskFlowMetadataSchema,
  taskFlowSchema,
} from "../validators/flows";
import type {
  integrationSchema,
  integrationTypeSchema,
  integrationUtilsSchema,
} from "../validators/integrations";
import type {
  functionPrimitiveMetadataSchema,
  functionPrimitiveSchema,
  primitiveMetadataSchema,
  primitiveSchema,
  stopPrimitiveSchema,
} from "../validators/primitives";
import type { resourceSchema } from "../validators/resources";
import type { workspaceSchema } from "../validators/workspaces";

export type DataType = z.infer<typeof dataTypeSchema>;

export type JsonSchema = z.infer<typeof baseJsonSchema> & {
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
};

export interface FlatInputSchema {
  path: string;
  type: DataType;
  itemsType?: DataType | { [key: string]: FlatInputSchema };
  required: boolean;
  description?: string;
  refUri: string;
}

export type InputSchema = z.infer<typeof inputSchema>;
export type OutputSchema = z.infer<typeof outputSchema>;

export type Workspace = z.infer<typeof workspaceSchema>;

export type EndpointFlowMetadata = z.infer<typeof endpointFlowMetadataSchema>;
export type TaskFlowMetadata = z.infer<typeof taskFlowMetadataSchema>;
export type ComponentFlowMetadata = z.infer<typeof componentFlowSchema>;

export type EndpointFlow = z.infer<typeof endpointFlowSchema>;
export type TaskFlow = z.infer<typeof taskFlowSchema>;

export type FlowType = z.infer<typeof flowTypesSchema>;
export type Flow = z.infer<typeof flowSchema>;
export type FlowMetadata =
  | ComponentFlowMetadata
  | EndpointFlowMetadata
  | TaskFlowMetadata;

export type Edge = z.infer<typeof edgeSchema>;

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
export type IntegrationUtils = z.infer<typeof integrationUtilsSchema>;

export type RawContent = z.infer<typeof rawContentSchema>;
export type PrimitiveType = "function" | "stop";
export type Primitive = z.infer<typeof primitiveSchema>;

export type PrimitiveMetadata = z.infer<typeof primitiveMetadataSchema>;
export type FunctionMetadata = z.infer<typeof functionPrimitiveMetadataSchema>;

export type FunctionPrimitive = z.infer<typeof functionPrimitiveSchema>;
export type StopPrimitive = z.infer<typeof stopPrimitiveSchema>;

export type FunctionRequirementsMessage = z.infer<
  typeof functionRequirementsMessageSchema
>;
export type FlowInputSchemaMessage = z.infer<
  typeof flowInputSchemaMessageSchema
>;
export type FlowOutputSchemaMessage = z.infer<
  typeof flowOutputSchemaMessageSchema
>;

export type BaseFormState<
  FormFields = Record<string, string>,
  TPayload = unknown,
> =
  | {
      status: "success";
      payload: TPayload;
      message?: string;
    }
  | {
      status: "validationError";
      fields: FormFields;
      errors: FormFields;
    }
  | {
      status: "error";
      fields: FormFields;
      message?: string;
    }
  | undefined;
