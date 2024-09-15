import type { Node, NodeProps, Edge as ReactFlowEdge } from "@xyflow/react";

import type { Primitive, PrimitiveType } from "@specly/shared/types";

export type NodeType = PrimitiveType;
export type FlowEdge = ReactFlowEdge<Record<string, unknown>, "deletable-edge">;
export type FlowNode = Node<Primitive, NodeType>;
export type FlowNodeProps = NodeProps<FlowNode>;
