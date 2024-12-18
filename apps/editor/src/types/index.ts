import type { Edge, Node, NodeProps } from "@xyflow/react";

import type { RouterOutputs } from "@integramind/api";

export type CanvasNodeType = "func";
export type CanvasNodeData = RouterOutputs["funcs"]["byId"];
export type CanvasNode = Node<CanvasNodeData, CanvasNodeType>;
export type CanvasEdge = Edge;
export type CanvasNodeProps = NodeProps<CanvasNode>;
