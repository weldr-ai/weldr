import type { RouterOutputs } from "@weldr/api";
import type { CanvasNodeType } from "@weldr/shared/types";
import type { Edge, Node, NodeProps } from "@xyflow/react";

export type CanvasNodeData = RouterOutputs["declarations"]["byId"];
export type CanvasNode = Node<
  CanvasNodeData | { type: "placeholder" },
  CanvasNodeType
>;
export type CanvasEdge = Edge;
export type CanvasNodeProps = NodeProps<CanvasNode>;

export type TPendingMessage =
  | "thinking"
  | "generating"
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
  toolName: "setupIntegrationTool";
  toolArgs?: Record<string, unknown>;
  toolResult: unknown;
};

export type CoderStreamableValue =
  | {
      id?: string;
      type: "coder";
      status: "initiated" | "coded" | "enriched" | "succeeded" | "failed";
    }
  | {
      id?: string;
      type: "coder";
      status: "deployed";
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
  | NodesStreamableValue
  | CoderStreamableValue;
