export type Type = "number" | "text";

export interface Input {
  name: string;
  type: Type;
}

export interface Output {
  name: string;
  type: Type;
}

export interface Flow {
  nodes: { id: string; type: BlockType }[];
  edges: {
    source: string;
    target: string;
  }[];
}

export type BlockType =
  | "access-point-block"
  | "workflow-trigger-block"
  | "query-block"
  | "action-block"
  | "logical-processing-block"
  | "ai-processing-block"
  | "logical-branch-block"
  | "semantic-branch-block"
  | "response-block";
