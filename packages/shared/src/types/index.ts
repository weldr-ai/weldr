import type { z } from "zod";
import type {
  baseJsonSchema,
  conversationMessageSchema,
  conversationSchema,
  inputSchema,
  outputSchema,
  rawDescriptionSchema,
  varTypeSchema,
} from "../validators/common";
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
  functionPrimitiveMetadataSchema,
  functionPrimitiveSchema,
  iteratorPrimitiveMetadataSchema,
  iteratorPrimitiveSchema,
  matcherPrimitiveMetadataSchema,
  matcherPrimitiveSchema,
  primitiveBaseSchema,
  primitiveMetadataSchema,
  primitiveSchema,
  responsePrimitiveMetadataSchema,
  responsePrimitiveSchema,
} from "../validators/primitives";
import type {
  resourceMetadataSchema,
  resourceProvidersSchema,
  resourceSchema,
} from "../validators/resources";
import type { workspaceSchema } from "../validators/workspaces";

export type VarType = z.infer<typeof varTypeSchema>;

export type JsonSchema = z.infer<typeof baseJsonSchema> & {
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
};

export interface FlatInputSchema {
  path: string;
  type: VarType;
  itemsType?: VarType | { [key: string]: FlatInputSchema };
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
export type Flow = z.infer<typeof flowSchema>;
export type FlowMetadata =
  | ComponentFlowMetadata
  | EndpointFlowMetadata
  | TaskFlowMetadata;

export type Edge = z.infer<typeof edgeSchema>;

export type ConversationMessage = z.infer<typeof conversationMessageSchema>;
export type Conversation = z.infer<typeof conversationSchema>;

export type Resource = z.infer<typeof resourceSchema>;
export type ResourceMetadata = z.infer<typeof resourceMetadataSchema>;
export type ResourceProvider = z.infer<typeof resourceProvidersSchema>;

export type PrimitiveType = "function" | "matcher" | "iterator" | "response";
export type BasePrimitiveData = z.infer<typeof primitiveBaseSchema>;
export type Primitive = z.infer<typeof primitiveSchema>;
export type PrimitiveMetadata = z.infer<typeof primitiveMetadataSchema>;

export type FunctionMetadata = z.infer<typeof functionPrimitiveMetadataSchema>;
export type matcherMetadata = z.infer<typeof matcherPrimitiveMetadataSchema>;
export type IteratorMetadata = z.infer<typeof iteratorPrimitiveMetadataSchema>;
export type ResponseMetadata = z.infer<typeof responsePrimitiveMetadataSchema>;

export type FunctionPrimitive = z.infer<typeof functionPrimitiveSchema>;
export type MatcherPrimitive = z.infer<typeof matcherPrimitiveSchema>;
export type IteratorPrimitive = z.infer<typeof iteratorPrimitiveSchema>;
export type ResponsePrimitive = z.infer<typeof responsePrimitiveSchema>;

export type RawDescription = z.infer<typeof rawDescriptionSchema>;

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
