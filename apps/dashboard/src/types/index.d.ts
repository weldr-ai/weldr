import type { Edge, Node, NodeProps } from "reactflow";
import type { z } from "zod";

import type {
  edgeSchema,
  flowSchema,
  flowTypesSchema,
  functionMetadataSchema,
  functionRawDescriptionSchema,
  primitiveSchema,
  primitiveTypesSchema,
  resourceMetadataSchema,
  resourceProvidersSchema,
  resourceSchema,
  routeMetadataSchema,
  workflowMetadataSchema,
  workspaceSchema,
} from "@integramind/db/schema";

export type PrimitiveType = z.infer<typeof primitiveTypesSchema>;
export type FlowType = z.infer<typeof flowTypesSchema>;
export type FlowEdge = Edge<"deletable-edge">;
export type FlowNode =
  | RouteNode
  | WorkflowNode
  | FunctionNode
  | ConditionalBranchNode
  | IteratorNode
  | ResponseNode;

export type BaseNode<T> = Node<T, PrimitiveType>;
export type BaseNodeProps<T> = NodeProps<T>;
export interface BaseNodeData {
  id: string;
  name: string;
  description?: string | null;
  type: PrimitiveType;
}

export type RouteMetadata = z.infer<typeof routeMetadataSchema>;
export type RouteData = BaseNodeData & RouteMetadata;
export type RouteNode = BaseNode<RouteData>;
export type RouteNodeProps = BaseNodeProps<RouteData>;

export type WorkflowMetadata = z.infer<typeof workflowMetadataSchema>;
export type WorkflowData = BaseNodeData & WorkflowMetadata;
export type WorkflowNode = BaseNode<WorkflowData>;
export type WorkflowNodeProps = BaseNodeProps<WorkflowData>;

export type FunctionMetadata = z.infer<typeof functionMetadataSchema>;
export type FunctionData = BaseNodeData & FunctionMetadata;
export type FunctionNode = BaseNode<FunctionData>;
export type FunctionNodeProps = BaseNodeProps<FunctionData>;

export type ConditionalBranchData = BaseNodeData;
export type ConditionalBranchNode = BaseNode<ConditionalBranchData>;
export type ConditionalBranchNodeProps = BaseNodeProps<ConditionalBranchData>;

export type IteratorData = BaseNodeData;
export type IteratorNode = BaseNode<IteratorData>;
export type IteratorNodeProps = BaseNodeProps<IteratorData>;

export type ResponseData = BaseNodeData;
export type ResponseNode = BaseNode<ResponseData>;
export type ResponseNodeProps = BaseNodeProps<ResponseData>;

export type ResourceMetadata = z.infer<typeof resourceMetadataSchema>;
export type Resource = z.infer<typeof resourceSchema>;
export type ResourceProvider = z.infer<typeof resourceProvidersSchema>;

export type Workspace = z.infer<typeof workspaceSchema>;
export type Flow = z.infer<typeof flowSchema>;

export type Primitive = z.infer<typeof primitiveSchema>;
export type PrimitiveMetadata =
  | RouteMetadata
  | WorkflowMetadata
  | FunctionMetadata;
export type PrimitiveData = BaseNodeData & PrimitiveMetadata;
export type FunctionRawDescription = z.infer<
  typeof functionRawDescriptionSchema
>;

export type Edge = z.infer<typeof edgeSchema>;

export interface Input {
  id: string;
  name: string;
  type: "text" | "number" | "functionResponse";
  testValue: string | number | null;
}
