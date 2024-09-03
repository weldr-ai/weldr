import type { Node, NodeProps, Edge as ReactFlowEdge } from "@xyflow/react";

import type { Primitive, PrimitiveType } from "@integramind/shared/types";

export type NodeType = PrimitiveType | "iterator-input" | "iterator-output";
export type FlowEdge = ReactFlowEdge<Record<string, unknown>, "deletable-edge">;
export type FlowNode = Node<Primitive, NodeType>;
export type FlowNodeProps = NodeProps<FlowNode>;
