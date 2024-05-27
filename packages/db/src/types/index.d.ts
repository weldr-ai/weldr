export type Type = "number" | "text";

export interface Input {
  name: string;
  type: Type;
}

export interface Output {
  name: string;
  type: Type;
}
