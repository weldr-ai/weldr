import type { Edge, Node } from "reactflow";
import type { z } from "zod";

import type {
  accessPointSchema,
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
  | "conditional-branch-block"
  | "loop-block"
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

export interface ConditionalBranchBlockData {
  id: string;
  name: string;
}

export type TConditionalBranchBlock = BaseBlock<ConditionalBranchBlockData>;

export interface LoopBlockData {
  id: string;
  name: string;
}

export type TLoopBlock = BaseBlock<LoopBlockData>;

export interface ResponseBlockData {
  id: string;
  name: string;
}

export type TResponseBlock = BaseBlock<ResponseBlockData>;

export type BlockData =
  | AccessPointBlockData
  | WorkflowTriggerBlockData
  | FunctionBlockData
  | ConditionalBranchBlockData
  | LoopBlockData
  | ResponseBlockData;

export type Block =
  | TAccessPointBlock
  | TWorkflowTriggerBlock
  | TFunctionBlock
  | TConditionalBranchBlock
  | TLoopBlock
  | TResponseBlock;

export type Workspace = z.infer<typeof workspaceSchema>;
export type CompoundBlock = z.infer<typeof compoundBlockSchema>;
export type Workflow = z.infer<typeof workflowSchema>;
export type AccessPoint = z.infer<typeof accessPointSchema>;
export type Resource = z.infer<typeof resourceSchema>;
