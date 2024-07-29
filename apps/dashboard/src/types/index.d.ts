import type { Node, NodeProps, Edge as ReactFlowEdge } from "reactflow";

import type { Primitive, PrimitiveType } from "@integramind/shared/types";

export type FlowEdge = ReactFlowEdge<"deletable-edge">;
export type FlowNode = Node<Primitive, PrimitiveType>;
export type FlowNodeProps = NodeProps<Primitive>;
