import type { Node } from "reactflow";
import type { z } from "zod";

import type {
  accessPointSchema,
  actionBlockSchema,
  compoundBlockSchema,
  resourceSchema,
  workflowSchema,
  workspaceSchema,
} from "@integramind/db/schema";

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

export type Workspace = z.infer<typeof workspaceSchema>;
export type CompoundBlock = z.infer<typeof compoundBlockSchema>;
export type Workflow = z.infer<typeof workflowSchema>;
export type AccessPoint = z.infer<typeof accessPointSchema>;
export type ActionBlock = z.infer<typeof actionBlockSchema>;
export type Resource = z.infer<typeof resourceSchema>;
