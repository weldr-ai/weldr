import type { Node, NodeProps } from "@xyflow/react";

import type { Func, InputSchema } from "@integramind/shared/types";

export type FlowNodeType = "func";
export type FlowNodeData = Func & {
  flow: { inputSchema?: InputSchema };
};
export type FlowNode = Node<FlowNodeData, FlowNodeType>;
export type FlowNodeProps = NodeProps<FlowNode>;
