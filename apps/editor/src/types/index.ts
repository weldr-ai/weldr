import type { Node, NodeProps } from "@xyflow/react";

import type { FlowType, Func, InputSchema } from "@integramind/shared/types";

export type FlowNodeType = "func";
export type FlowNodeData = Func & {
  flow: { inputSchema?: InputSchema; type: FlowType };
};
export type FlowNode = Node<FlowNodeData, FlowNodeType>;
export type FlowNodeProps = NodeProps<FlowNode>;
