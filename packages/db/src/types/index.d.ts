import type { z } from "zod";

import type {
  edgeSchema,
  flowSchema,
  flowTypesSchema,
  functionMetadataSchema,
  primitiveMetadataSchema,
  primitiveSchema,
  primitiveTypesSchema,
  resourceMetadataSchema,
  resourceSchema,
  routeMetadataSchema,
  workflowMetadataSchema,
} from "../schema";

export type VarType = "number" | "text";

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

export interface PrimitiveBaseData {
  id: string;
  name: string;
  description?: string | null;
  type: PrimitiveType;
}

export type FlowType = z.infer<typeof flowTypesSchema>;
export type Flow = z.infer<typeof flowSchema>;
export type Edge = z.infer<typeof edgeSchema>;

export type PrimitiveType = z.infer<typeof primitiveTypesSchema>;
export type PrimitiveMetadata = z.infer<typeof primitiveMetadataSchema>;
export type Primitive = z.infer<typeof primitiveSchema>;

export type ResourceMetadata = z.infer<typeof resourceMetadataSchema>;
export type Resource = z.infer<typeof resourceSchema>;

export type FunctionMetadata = z.infer<typeof functionMetadataSchema>;
export type FunctionData = PrimitiveBaseData & FunctionMetadata;

export type RouteMetadata = z.infer<typeof routeMetadataSchema>;
export type RouteData = PrimitiveBaseData & RouteMetadata;

export type WorkflowMetadata = z.infer<typeof workflowMetadataSchema>;
export type WorkflowData = PrimitiveBaseData & WorkflowMetadata;
