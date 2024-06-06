import type { Edge, Node, NodeProps } from "reactflow";
import type { z } from "zod";

import type {
  flowSchema,
  flowTypesSchema,
  primitiveSchema,
  resourceSchema,
  workspaceSchema,
} from "@integramind/db/schema";

export type NodeType =
  | "route"
  | "workflow"
  | "function"
  | "conditional-branch"
  | "loop"
  | "response";

export type FlowType = z.infer<typeof flowTypesSchema>;
export type FlowEdge = Edge<"deletable-edge">;
export type FlowNode =
  | RouteNode
  | WorkflowNode
  | FunctionNode
  | ConditionalBranchNode
  | LoopNode
  | ResponseNode;

export type BaseNode<T> = Node<T, NodeType>;
export type BaseNodeProps<T> = NodeProps<T>;
export interface BaseNodeData {
  id: string;
  name: string;
  description?: string | null;
}

export interface RouteMetadata {
  type: "route";
  actionType: "retrieve" | "submit" | "modify" | "delete";
  urlPath: string;
}

export type RouteData = BaseNodeData & RouteMetadata;
export type RouteNode = BaseNode<RouteData>;
export type RouteNodeProps = BaseNodeProps<RouteData>;

export interface WorkflowMetadata {
  type: "workflow";
  triggerType: "webhook" | "schedule";
}

export type WorkflowData = BaseNodeData & WorkflowMetadata;
export type WorkflowNode = BaseNode<WorkflowData>;
export type WorkflowNodeProps = BaseNodeProps<WorkflowData>;

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
  type: "function";
  inputs: Input[];
  outputs: Output[];
  generatedCode: string;
  isCodeUpdated: boolean;
}

export type FunctionData = BaseNodeData & FunctionMetadata;
export type FunctionNode = BaseNode<FunctionData>;
export type FunctionNodeProps = BaseNodeProps<FunctionData>;

export type ConditionalBranchData = BaseNodeData;
export type ConditionalBranchNode = BaseNode<ConditionalBranchData>;
export type ConditionalBranchNodeProps = BaseNodeProps<ConditionalBranchData>;

export type LoopData = BaseNodeData;
export type LoopNode = BaseNode<LoopData>;
export type LoopNodeProps = BaseNodeProps<LoopData>;

export type ResponseData = BaseNodeData;
export type ResponseNode = BaseNode<ResponseData>;
export type ResponseNodeProps = BaseNodeProps<ResponseData>;

export type Workspace = z.infer<typeof workspaceSchema>;
export type Primitive = z.infer<typeof primitiveSchema>;
export type Flow = z.infer<typeof flowSchema>;
export type Resource = z.infer<typeof resourceSchema>;
