import type { Edge, Node, NodeProps } from "reactflow";
import type { z } from "zod";

import type {
  flowSchema,
  flowTypesSchema,
  resourceSchema,
  workspaceSchema,
} from "@integramind/db/schema";

export type PrimitiveType =
  | "route"
  | "workflow"
  | "function"
  | "conditional-branch"
  | "loop"
  | "response";

export type FlowType = z.infer<typeof flowTypesSchema>;

export type FlowEdge = Edge;

export type BasePrimitive<T> = Node<T, PrimitiveType>;
export type BasePrimitiveProps<T> = NodeProps<T>;

export interface RouteMetadata {
  id: string;
  name: string;
  description?: string | null;
  actionType: "retrieve" | "submit" | "modify" | "delete";
  urlPath: string;
}

export type RoutePrimitive = BasePrimitive<RouteMetadata>;
export type RoutePrimitiveProps = BasePrimitiveProps<RouteMetadata>;

export interface WorkflowMetadata {
  id: string;
  name: string;
  description?: string | null;
  triggerType: "webhook" | "schedule";
}

export type WorkflowPrimitive = BasePrimitive<WorkflowMetadata>;
export type WorkflowPrimitiveProps = BasePrimitiveProps<WorkflowMetadata>;

export type Type = "number" | "text";

export interface Input {
  name: string;
  type: Type;
}

export interface Output {
  name: string;
  type: Type;
}

export interface FunctionMetadata {
  id: string;
  name: string;
  description: string;
  type: "function";
  inputs: Input[];
  outputs: Output[];
  generatedCode: string;
  isCodeUpdated: boolean;
}

export type FunctionPrimitive = BasePrimitive<FunctionMetaData>;
export type FunctionPrimitiveProps = BasePrimitiveProps<FunctionMetaData>;

export interface ConditionalBranchMetadata {
  id: string;
  name: string;
}

export type ConditionalBranchPrimitive =
  BasePrimitive<ConditionalBranchMetadata>;
export type ConditionalBranchPrimitiveProps =
  BasePrimitiveProps<ConditionalBranchMetadata>;

export interface LoopMetadata {
  id: string;
  name: string;
}

export type LoopPrimitive = BasePrimitive<LoopMetadata>;
export type LoopPrimitiveProps = BasePrimitiveProps<LoopMetadata>;

export interface ResponseMetadata {
  id: string;
  name: string;
}

export type ResponsePrimitive = BasePrimitive<ResponseMetadata>;
export type ResponsePrimitiveProps = BasePrimitiveProps<ResponseMetadata>;

export type PrimitiveMetadata =
  | RouteMetadata
  | WorkflowMetadata
  | FunctionMetadata
  | ConditionalBranchMetadata
  | LoopMetadata
  | ResponseMetadata;

export type Primitive =
  | RoutePrimitive
  | WorkflowPrimitive
  | FunctionPrimitive
  | ConditionalBranchPrimitive
  | LoopPrimitive
  | ResponsePrimitive;

export type Workspace = z.infer<typeof workspaceSchema>;
export type Flow = z.infer<typeof flowSchema>;
export type Resource = z.infer<typeof resourceSchema>;
