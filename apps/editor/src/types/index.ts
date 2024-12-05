import type { Node, NodeProps } from "@xyflow/react";

import type { InputSchema, Primitive } from "@integramind/shared/types";

export type FlowNodeType = "primitive";
export type FlowNodeData = Primitive & { flow: { inputSchema?: InputSchema } };
export type FlowNode = Node<FlowNodeData, FlowNodeType>;
export type FlowNodeProps = NodeProps<FlowNode>;
