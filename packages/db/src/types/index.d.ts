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
  nodes: {
    id: string;
    type: BlockType;
  }[];
  edges: {
    id: string;
    source: string;
    target: string;
  }[];
}

export type BlockType =
  | "access-point-block"
  | "workflow-block"
  | "function-block"
  | "conditional-branch-block"
  | "loop-block"
  | "response-block";
