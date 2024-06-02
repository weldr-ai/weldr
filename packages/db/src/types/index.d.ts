export type Type = "number" | "text";

export interface Input {
  name: string;
  type: Type;
}

export interface Output {
  name: string;
  type: Type;
}

export type PrimitiveType =
  | "access-point"
  | "workflow"
  | "function"
  | "conditional-branch"
  | "loop"
  | "response";

export interface Flow {
  primitives: {
    id: string;
    type: PrimitiveType;
  }[];
  edges: {
    id: string;
    source: string;
    target: string;
  }[];
}
