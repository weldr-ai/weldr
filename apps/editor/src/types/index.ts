import type { Edge, Node, NodeProps } from "@xyflow/react";

import type { Func } from "@integramind/shared/types";

export type CanvasNodeType = "func";
export type CanvasNodeData = Func;
export type CanvasNode = Node<CanvasNodeData, CanvasNodeType>;
export type CanvasEdge = Edge;
export type CanvasNodeProps = NodeProps<CanvasNode>;
