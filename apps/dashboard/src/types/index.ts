import type { Node, NodeProps, Edge as ReactFlowEdge } from "@xyflow/react";

import type { Primitive, PrimitiveType } from "@integramind/shared/types";

export type FlowEdge = ReactFlowEdge<Record<string, unknown>, "deletable-edge">;
export type FlowNode = Node<Primitive, PrimitiveType>;
export type FlowNodeProps = NodeProps<FlowNode>;
