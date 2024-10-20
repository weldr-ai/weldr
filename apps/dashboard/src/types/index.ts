import type { Node, NodeProps, Edge as ReactFlowEdge } from "@xyflow/react";

import type {
  Conversation,
  InputSchema,
  Primitive,
  PrimitiveType,
} from "@specly/shared/types";

export type NodeType = PrimitiveType;
export type FlowEdge = ReactFlowEdge<Record<string, unknown>, "deletable-edge">;
export type FlowNodeData = Primitive & {
  flow: { inputSchema: InputSchema | undefined };
  conversation: Conversation;
};
export type FlowNode = Node<FlowNodeData, NodeType>;
export type FlowNodeProps = NodeProps<FlowNode>;
