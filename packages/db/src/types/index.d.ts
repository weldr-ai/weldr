import type { z } from "zod";

import type {
  primitiveMetadataSchema,
  primitiveTypesSchema,
  resourceMetadataSchema,
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

export type PrimitiveType = z.infer<typeof primitiveTypesSchema>;

export interface Flow {
  primitives: {
    id: string;
    type: PrimitiveType;
  }[];
  edges: {
    id: string;
    source: string;
    target: string;
  }[];
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
}

export type PrimitiveMetadata = z.infer<typeof primitiveMetadataSchema>;
export type ResourceMetadata = z.infer<typeof resourceMetadataSchema>;
