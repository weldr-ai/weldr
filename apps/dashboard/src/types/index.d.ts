import type { Node } from "reactflow";

export type BlockType =
  | "route-entry-block"
  | "workflow-entry-block"
  | "query-block"
  | "action-block"
  | "logical-processing-block"
  | "ai-processing-block"
  | "logical-branch-block"
  | "semantic-branch-block"
  | "response-block";

export type BaseBlock = Node;
