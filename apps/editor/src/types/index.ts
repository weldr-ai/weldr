import type { Edge, Node, NodeProps } from "@xyflow/react";

import type { RouterOutputs } from "@weldr/api";

export type CanvasNodeTypes = "func" | "endpoint" | "module";
export type CanvasNodeData =
  | RouterOutputs["funcs"]["byId"]
  | RouterOutputs["endpoints"]["byId"];
export type CanvasNode = Node<CanvasNodeData, CanvasNodeTypes>;
export type CanvasEdge = Edge;
export type CanvasNodeProps = NodeProps<CanvasNode>;
