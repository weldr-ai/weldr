import type { Edge, Node, NodeProps } from "reactflow";
import type { z } from "zod";

import type {
  accessPointSchema,
  componentSchema,
  resourceSchema,
  workflowSchema,
  workspaceSchema,
} from "@integramind/db/schema";

export type PrimitiveType =
  | "access-point"
  | "workflow"
  | "function"
  | "conditional-branch"
  | "loop"
  | "response";

export type FlowEdge = Edge;

export type BasePrimitive<T> = Node<T, PrimitiveType>;
export type BasePrimitiveProps<T> = NodeProps<T>;

export interface AccessPointData {
  id: string;
  name: string;
  description?: string | null;
  actionType: "retrieve" | "submit" | "modify" | "delete";
  urlPath: string;
}

export type AccessPointPrimitive = BasePrimitive<AccessPointData>;
export type AccessPointPrimitiveProps = BasePrimitiveProps<AccessPointData>;

export interface WorkflowData {
  id: string;
  name: string;
  triggerType: "webhook" | "schedule";
}

export type WorkflowPrimitive = BasePrimitive<WorkflowData>;
export type WorkflowPrimitiveProps = BasePrimitiveProps<WorkflowData>;

export interface FunctionData {
  id: string;
  name: string;
  description?: string | null;
}

export type FunctionPrimitive = BasePrimitive<FunctionData>;
export type FunctionPrimitiveProps = BasePrimitiveProps<FunctionData>;

export interface ConditionalBranchData {
  id: string;
  name: string;
}

export type ConditionalBranchPrimitive = BasePrimitive<ConditionalBranchData>;
export type ConditionalBranchPrimitiveProps =
  BasePrimitiveProps<ConditionalBranchData>;

export interface LoopData {
  id: string;
  name: string;
}

export type LoopPrimitive = BasePrimitive<LoopData>;
export type LoopPrimitiveProps = BasePrimitiveProps<LoopData>;

export interface ResponseData {
  id: string;
  name: string;
}

export type ResponsePrimitive = BasePrimitive<ResponseData>;
export type ResponsePrimitiveProps = BasePrimitiveProps<ResponseData>;

export type PrimitiveData =
  | AccessPointData
  | WorkflowData
  | FunctionData
  | ConditionalBranchData
  | LoopData
  | ResponseData;

export type Primitive =
  | AccessPointPrimitive
  | WorkflowPrimitive
  | FunctionPrimitive
  | ConditionalBranchPrimitive
  | LoopPrimitive
  | ResponsePrimitive;

export type Workspace = z.infer<typeof workspaceSchema>;
export type Component = z.infer<typeof componentSchema>;
export type Workflow = z.infer<typeof workflowSchema>;
export type AccessPoint = z.infer<typeof accessPointSchema>;
export type Resource = z.infer<typeof resourceSchema>;
