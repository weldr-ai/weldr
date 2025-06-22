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
  type: "text";
  text: string;
};

export type ToolStreamableValue = {
  id?: string;
  type: "tool";
  toolName: "setup_integration";
  toolArgs?: Record<string, unknown>;
  toolResult: unknown;
  toolCallId: string;
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

export type NodesStreamableValue = {
  type: "nodes";
  node: CanvasNodeData;
};

export type EndStreamableValue = {
  type: "end";
};

export type TStreamableValue =
  | TextStreamableValue
  | ToolStreamableValue
  | NodesStreamableValue
  | CoderStreamableValue
  | EndStreamableValue;

// SSE-specific event types
export type SSEConnectionEvent = {
  type: "connected";
  clientId: string;
  streamId: string;
  workflowRunning?: boolean;
};

export type SSEWorkflowCompleteEvent = {
  type: "workflow_complete";
};

export type SSEErrorEvent = {
  type: "error";
  error: string;
};

export type SSEEvent =
  | SSEConnectionEvent
  | SSEWorkflowCompleteEvent
  | SSEErrorEvent
  | TStreamableValue;

// Trigger API response type
export type TriggerWorkflowResponse = {
  success: boolean;
  streamId: string;
  runId: string;
  message?: string;
};
