import type { z } from "zod";
import type { edgeSchema } from "../validators/edges";
import type { flowSchema, flowTypesSchema } from "../validators/flows";
import type {
  baseJsonSchema,
  functionPrimitiveMetadataSchema,
  functionPrimitiveSchema,
  inputSchema,
  iteratorPrimitiveMetadataSchema,
  iteratorPrimitiveSchema,
  matcherPrimitiveMetadataSchema,
  matcherPrimitiveSchema,
  outputSchema,
  primitiveBaseSchema,
  primitiveMetadataSchema,
  primitiveSchema,
  rawDescriptionSchema,
  responsePrimitiveMetadataSchema,
  responsePrimitiveSchema,
  routePrimitiveMetadataSchema,
  routePrimitiveSchema,
  varTypeSchema,
  workflowPrimitiveMetadataSchema,
  workflowPrimitiveSchema,
} from "../validators/primitives";
import type {
  resourceMetadataSchema,
  resourceProvidersSchema,
  resourceSchema,
} from "../validators/resources";
import type { workspaceSchema } from "../validators/workspaces";

export type VarType = z.infer<typeof varTypeSchema>;

export type Input = z.infer<typeof inputSchema>;

export type JsonSchema = z.infer<typeof baseJsonSchema> & {
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
};

export type Output = z.infer<typeof outputSchema>;

export type Workspace = z.infer<typeof workspaceSchema>;

export type FlowType = z.infer<typeof flowTypesSchema>;
export type Flow = z.infer<typeof flowSchema>;

export type Edge = z.infer<typeof edgeSchema>;

export type Resource = z.infer<typeof resourceSchema>;
export type ResourceMetadata = z.infer<typeof resourceMetadataSchema>;
export type ResourceProvider = z.infer<typeof resourceProvidersSchema>;

export type PrimitiveType =
  | "function"
  | "workflow"
  | "route"
  | "matcher"
  | "iterator"
  | "response";
export type BasePrimitiveData = z.infer<typeof primitiveBaseSchema>;
export type Primitive = z.infer<typeof primitiveSchema>;
export type PrimitiveMetadata = z.infer<typeof primitiveMetadataSchema>;

export type RouteMetadata = z.infer<typeof routePrimitiveMetadataSchema>;
export type WorkflowMetadata = z.infer<typeof workflowPrimitiveMetadataSchema>;
export type FunctionMetadata = z.infer<typeof functionPrimitiveMetadataSchema>;
export type matcherMetadata = z.infer<typeof matcherPrimitiveMetadataSchema>;
export type IteratorMetadata = z.infer<typeof iteratorPrimitiveMetadataSchema>;
export type ResponseMetadata = z.infer<typeof responsePrimitiveMetadataSchema>;

export type RoutePrimitive = z.infer<typeof routePrimitiveSchema>;
export type WorkflowPrimitive = z.infer<typeof workflowPrimitiveSchema>;
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
