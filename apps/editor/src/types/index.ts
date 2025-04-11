import type { RouterOutputs } from "@weldr/api";
import type { CanvasNodeType } from "@weldr/shared/types";
import type { Edge, Node, NodeProps } from "@xyflow/react";

export type CanvasNodeData = RouterOutputs["declarations"]["byId"];
export type CanvasNode = Node<
  | CanvasNodeData
  | {
      type: "preview";
      projectId: string;
      machineId: string | null;
    },
  CanvasNodeType
>;
export type CanvasEdge = Edge;
export type CanvasNodeProps = NodeProps<CanvasNode>;

export type TPendingMessage = "thinking" | "waiting" | "building" | null;

export type TStreamableValue =
  | {
      type: "text";
      text: string;
    }
  | {
      id: string;
      type: "tool";
      toolName:
        | "initializeProjectTool"
        | "implementTool"
        | "setupIntegrationTool";
      toolArgs?: Record<string, unknown>;
      toolResult: unknown;
    }
  | {
      id: string;
      type: "version";
      versionId: string;
      versionMessage: string;
      versionNumber: number;
      machineId: string;
    }
  | {
      id?: string;
      type: "code";
      files: Record<
        string,
        {
          originalContent: string | undefined;
          newContent: string | undefined;
        }
      >;
    }
  | {
      type: "nodes";
      node: CanvasNodeData;
    };
