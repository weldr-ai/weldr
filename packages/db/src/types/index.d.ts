import type { z } from "zod";

import type {
  dataResourceMetadataSchema,
  primitiveMetadataSchema,
  primitiveTypesSchema,
} from "../schema";

export type VarType = "number" | "text";

export interface Input {
  name: string;
  type: VarType;
}

export interface Output {
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
export type ResourceMetadata = z.infer<typeof dataResourceMetadataSchema>;
