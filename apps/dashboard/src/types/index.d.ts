import type { Node } from "reactflow";

export type BlockType =
  | "access-point-block"
  | "workflow-trigger-block"
  | "query-block"
  | "action-block"
  | "logical-processing-block"
  | "ai-processing-block"
  | "logical-branch-block"
  | "semantic-branch-block"
  | "response-block";

export type BaseBlock<T> = Node<T, BlockType>;

export interface AccessPointBlockData {
  id: string;
  name: string;
  description?: string | null;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  urlPath: string;
}

export type TAccessPointBlock = BaseBlock<AccessPointBlockData>;

export interface WorkflowTriggerBlockData {
  id: string;
  name: string;
}

export type TWorkflowTriggerBlock = BaseBlock<WorkflowTriggerBlockData>;

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
  | AccessPointBlockData
  | WorkflowTriggerBlockData
  | QueryBlockData
  | ActionBlockData
  | LogicalProcessingBlockData
  | AIProcessingBlockData
  | LogicalBranchBlockData
  | SemanticBranchBlockData
  | ResponseBlockData;

export type Block =
  | TAccessPointBlock
  | TWorkflowTriggerBlock
  | TQueryBlock
  | TActionBlock
  | TLogicalProcessingBlock
  | TAIProcessingBlock
  | TLogicalBranchBlock
  | TSemanticBranchBlock
  | TResponseBlock;
