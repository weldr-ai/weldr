import type { Node } from "reactflow";

export type BlockType =
  | "route-entry-block"
  | "workflow-entry-block"
  | "query-block"
  | "action-block"
  | "logical-processing-block"
  | "ai-processing-block"
  | "logical-branch-block"
  | "semantic-branch-block"
  | "response-block";

export type BaseBlock<T> = Node<T, BlockType>;

export interface RouteEntryBlockData {
  id: string;
  name: string;
  description?: string | null;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  urlPath: string;
}

export type TRouteEntryBlock = BaseBlock<RouteEntryBlockData>;

export interface WorkflowEntryBlockData {
  id: string;
  name: string;
}

export type TWorkflowEntryBlock = BaseBlock<WorkflowEntryBlockData>;

export interface QueryBlockData {
  id: string;
  name: string;
}

export type TQueryBlock = BaseBlock<QueryBlockData>;

export interface ActionBlockData {
  id: string;
  name: string;
}

export type TActionBlock = BaseBlock<QueryBlockData>;

export interface LogicalProcessingBlockData {
  id: string;
  name: string;
}

export type TLogicalProcessingBlock = BaseBlock<LogicalProcessingBlockData>;

export interface AIProcessingBlockData {
  id: string;
  name: string;
}

export type TAIProcessingBlock = BaseBlock<AIProcessingBlockData>;

export interface LogicalBranchBlockData {
  id: string;
  name: string;
}

export type TLogicalBranchBlock = BaseBlock<LogicalBranchBlockData>;

export interface SemanticBranchBlockData {
  id: string;
  name: string;
}

export type TSemanticBranchBlock = BaseBlock<SemanticBranchBlockData>;

export interface ResponseBlockData {
  id: string;
  name: string;
}

export type TResponseBlock = BaseBlock<ResponseBlockData>;

export type BlockData =
  | RouteEntryBlockData
  | WorkflowEntryBlockData
  | QueryBlockData
  | ActionBlockData
  | LogicalProcessingBlockData
  | AIProcessingBlockData
  | LogicalBranchBlockData
  | SemanticBranchBlockData
  | ResponseBlockData;

export type Block =
  | TRouteEntryBlock
  | TWorkflowEntryBlock
  | TQueryBlock
  | TActionBlock
  | TLogicalProcessingBlock
  | TAIProcessingBlock
  | TLogicalBranchBlock
  | TSemanticBranchBlock
  | TResponseBlock;
