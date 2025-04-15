import type { RouterOutputs } from "@weldr/api";
import type { CanvasNodeType } from "@weldr/shared/types";
import type { Edge, Node, NodeProps } from "@xyflow/react";

export type CanvasNodeData = RouterOutputs["declarations"]["byId"];
export type CanvasNode = Node<CanvasNodeData, CanvasNodeType>;
export type CanvasEdge = Edge;
export type CanvasNodeProps = NodeProps<CanvasNode>;

export type TPendingMessage =
  | "thinking"
  | "waiting"
  | "building"
  | "enriching"
  | "deploying"
  | null;

export type TextStreamableValue = {
  type: "paragraph";
  text: string;
};

export type ToolStreamableValue = {
  id?: string;
  type: "tool";
  toolName: "implementTool" | "setupIntegrationTool";
  toolArgs?: Record<string, unknown>;
  toolResult: unknown;
};

export type VersionStreamableValue = {
  id?: string;
  createdAt?: Date;
  type: "version";
  versionId: string;
  versionMessage: string;
  versionNumber: number;
  versionDescription: string;
  changedFiles: {
    path: string;
    status: "pending" | "success";
  }[];
};

export type NodesStreamableValue = {
  type: "nodes";
  node: CanvasNodeData;
};

export type TStreamableValue =
  | TextStreamableValue
  | ToolStreamableValue
  | VersionStreamableValue
  | NodesStreamableValue;
