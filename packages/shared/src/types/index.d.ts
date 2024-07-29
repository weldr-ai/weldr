import type { z } from "zod";
import type { edgeSchema } from "../validators/edges";
import type { flowSchema, flowTypesSchema } from "../validators/flows";
import type {
  conditionalBranchPrimitiveMetadataSchema,
  conditionalBranchPrimitiveSchema,
  functionPrimitiveMetadataSchema,
  functionPrimitiveSchema,
  functionRawDescriptionSchema,
  iteratorPrimitiveMetadataSchema,
  iteratorPrimitiveSchema,
  primitiveBaseSchema,
  primitiveMetadataSchema,
  primitiveSchema,
  primitiveTypesSchema,
  responsePrimitiveMetadataSchema,
  responsePrimitiveSchema,
  routePrimitiveMetadataSchema,
  routePrimitiveSchema,
  workflowPrimitiveMetadataSchema,
  workflowPrimitiveSchema,
} from "../validators/primitives";
import type {
  resourceMetadataSchema,
  resourceProvidersSchema,
  resourceSchema,
} from "../validators/resources";
import type { workspaceSchema } from "../validators/workspaces";

export type VarType = "number" | "text" | "functionResponse";

export interface Input {
  id: string;
  name: string;
  type: VarType;
  testValue?: string | number | null;
}

export interface Output {
  id: string;
  name: string;
  type: VarType;
}

export type Workspace = z.infer<typeof workspaceSchema>;

export type FlowType = z.infer<typeof flowTypesSchema>;
export type Flow = z.infer<typeof flowSchema>;

export type Edge = z.infer<typeof edgeSchema>;

export type Resource = z.infer<typeof resourceSchema>;
export type ResourceMetadata = z.infer<typeof resourceMetadataSchema>;
export type ResourceProvider = z.infer<typeof resourceProvidersSchema>;

export type PrimitiveType = z.infer<typeof primitiveTypesSchema>;
export type BasePrimitiveData = z.infer<typeof primitiveBaseSchema>;
export type Primitive = z.infer<typeof primitiveSchema>;
export type PrimitiveMetadata = z.infer<typeof primitiveMetadataSchema>;

export type RouteMetadata = z.infer<typeof routePrimitiveMetadataSchema>;
export type WorkflowMetadata = z.infer<typeof workflowPrimitiveMetadataSchema>;
export type FunctionMetadata = z.infer<typeof functionPrimitiveMetadataSchema>;
export type ConditionalBranchMetadata = z.infer<
  typeof conditionalBranchPrimitiveMetadataSchema
>;
export type IteratorMetadata = z.infer<typeof iteratorPrimitiveMetadataSchema>;
export type ResponseMetadata = z.infer<typeof responsePrimitiveMetadataSchema>;

export type RoutePrimitive = z.infer<typeof routePrimitiveSchema>;
export type WorkflowPrimitive = z.infer<typeof workflowPrimitiveSchema>;
export type FunctionPrimitive = z.infer<typeof functionPrimitiveSchema>;
export type ConditionalBranchPrimitive = z.infer<
  typeof conditionalBranchPrimitiveSchema
>;
export type IteratorPrimitive = z.infer<typeof iteratorPrimitiveSchema>;
export type ResponsePrimitive = z.infer<typeof responsePrimitiveSchema>;

export type FunctionRawDescription = z.infer<
  typeof functionRawDescriptionSchema
>;
