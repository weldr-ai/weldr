import type { z } from "zod";
import type {
  baseJsonSchema,
  conversationSchema,
  dataTypeSchema,
  functionRequirementsMessageSchema,
  inputSchema,
  outputSchema,
  rawDescriptionSchema,
} from "../validators/common";
import type { edgeSchema } from "../validators/edges";
import type {
  baseFlowSchema,
  componentFlowSchema,
  endpointFlowMetadataSchema,
  endpointFlowSchema,
  flowSchema,
  flowTypesSchema,
  taskFlowMetadataSchema,
  taskFlowSchema,
} from "../validators/flows";
import type {
  baseIntegrationSchema,
  integrationSchema,
  integrationTypeSchema,
  integrationUtilsSchema,
} from "../validators/integrations";
import type {
  functionPrimitiveMetadataSchema,
  functionPrimitiveSchema,
  primitiveMetadataSchema,
  primitiveSchema,
  responsePrimitiveSchema,
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
export type BaseFlow = z.infer<typeof baseFlowSchema>;
export type Flow = z.infer<typeof flowSchema>;
export type FlowMetadata =
  | ComponentFlowMetadata
  | EndpointFlowMetadata
  | TaskFlowMetadata;

export type Edge = z.infer<typeof edgeSchema>;

export interface ConversationMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
  rawContent?: RawDescription[];
  createdAt?: Date;
  updatedAt?: Date;
  conversationId: string;
}
export type Conversation = z.infer<typeof conversationSchema>;

export type Resource = z.infer<typeof resourceSchema>;

export type BaseIntegration = z.infer<typeof baseIntegrationSchema>;
export type Integration = z.infer<typeof integrationSchema>;
export type IntegrationType = z.infer<typeof integrationTypeSchema>;
export type IntegrationUtils = z.infer<typeof integrationUtilsSchema>;

export type PrimitiveType = "function" | "response";
export type Primitive = z.infer<typeof primitiveSchema>;

export type PrimitiveMetadata = z.infer<typeof primitiveMetadataSchema>;
export type FunctionMetadata = z.infer<typeof functionPrimitiveMetadataSchema>;

export type FunctionPrimitive = z.infer<typeof functionPrimitiveSchema>;
export type ResponsePrimitive = z.infer<typeof responsePrimitiveSchema>;

export type RawDescription = z.infer<typeof rawDescriptionSchema>;
export type FunctionRequirementsMessage = z.infer<
  typeof functionRequirementsMessageSchema
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
