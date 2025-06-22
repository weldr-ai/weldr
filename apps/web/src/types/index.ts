import type { RouterOutputs } from "@weldr/api";
import type { CanvasNodeType } from "@weldr/shared/types";
import type { Edge, Node, NodeProps } from "@xyflow/react";

export type CanvasNodeData = RouterOutputs["declarations"]["byId"];
export type CanvasNode = Node<CanvasNodeData, CanvasNodeType>;
export type CanvasEdge = Edge;
export type CanvasNodeProps = NodeProps<CanvasNode>;
