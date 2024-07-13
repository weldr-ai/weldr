import type { z } from "zod";

import type {
  edgeSchema,
  flowSchema,
  flowTypesSchema,
  primitiveMetadataSchema,
  primitiveSchema,
  primitiveTypesSchema,
  resourceMetadataSchema,
  routeMetadataSchema,
} from "../schema";

export type VarType = "number" | "text";

export interface Input {
  id: string;
  name: string;
  type: VarType;
}

export interface Output {
  id: string;
  name: string;
  type: VarType;
}

export type FlowType = z.infer<typeof flowTypesSchema>;
export type Flow = z.infer<typeof flowSchema>;
export type Edge = z.infer<typeof edgeSchema>;

export type Primitive = z.infer<typeof primitiveSchema>;
export type PrimitiveType = z.infer<typeof primitiveTypesSchema>;
export type PrimitiveMetadata = z.infer<typeof primitiveMetadataSchema>;
export type ResourceMetadata = z.infer<typeof resourceMetadataSchema>;

export type RouteMetadata = z.infer<typeof routeMetadataSchema>;
