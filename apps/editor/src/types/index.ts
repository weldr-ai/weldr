import type { Node, NodeProps } from "@xyflow/react";

import type {
  FlowType,
  InputSchema,
  Primitive,
} from "@integramind/shared/types";

export type FlowNodeType = "primitive";
export type FlowNodeData = Primitive & {
  flow: { inputSchema?: InputSchema; type: FlowType };
};
export type FlowNode = Node<FlowNodeData, FlowNodeType>;
export type FlowNodeProps = NodeProps<FlowNode>;
