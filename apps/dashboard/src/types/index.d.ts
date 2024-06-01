import type { Edge, Node } from "reactflow";
import type { z } from "zod";

import type {
  accessPointSchema,
  actionBlockSchema,
  compoundBlockSchema,
  resourceSchema,
  workflowSchema,
  workspaceSchema,
} from "@integramind/db/schema";

export type FlowEdge = Edge;

export type BlockType =
  | "access-point-block"
  | "workflow-block"
  | "function-block"
  | "logical-branch-block"
  | "semantic-branch-block"
  | "response-block";

export type BaseBlock<T> = Node<T, BlockType>;

export interface AccessPointBlockData {
  id: string;
  name: string;
  description?: string | null;
  actionType: "retrieve" | "submit" | "modify" | "delete";
  urlPath: string;
}

export type TAccessPointBlock = BaseBlock<AccessPointBlockData>;

export interface WorkflowTriggerBlockData {
  id: string;
  name: string;
  triggerType: "webhook" | "schedule";
}

export type TWorkflowTriggerBlock = BaseBlock<WorkflowTriggerBlockData>;

export interface FunctionBlockData {
  id: string;
  name: string;
  description?: string | null;
}

export type TFunctionBlock = BaseBlock<FunctionBlockData>;

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
  | FunctionBlockData
  | LogicalBranchBlockData
  | SemanticBranchBlockData
  | ResponseBlockData;

export type Block =
  | TAccessPointBlock
  | TWorkflowTriggerBlock
  | TFunctionBlock
  | TLogicalBranchBlock
  | TSemanticBranchBlock
  | TResponseBlock;

export type Workspace = z.infer<typeof workspaceSchema>;
export type CompoundBlock = z.infer<typeof compoundBlockSchema>;
export type Workflow = z.infer<typeof workflowSchema>;
export type AccessPoint = z.infer<typeof accessPointSchema>;
export type ActionBlock = z.infer<typeof actionBlockSchema>;
export type Resource = z.infer<typeof resourceSchema>;
