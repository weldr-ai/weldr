import type { Edge, Node, NodeProps } from "@xyflow/react";

export type CanvasNodeTypes = "db-table" | "endpoint" | "page" | "preview";
// export type CanvasNodeData = RouterOutputs["nodes"]["byId"];
export type CanvasNode = Node<Record<string, unknown>, CanvasNodeTypes>;
export type CanvasEdge = Edge;
export type CanvasNodeProps = NodeProps<CanvasNode>;

export type TPendingMessage = "thinking" | "waiting" | "building" | null;
