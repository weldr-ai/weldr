export type VarType = "number" | "text";

export interface Input {
  name: string;
  type: VarType;
}

export interface Output {
  name: string;
  type: VarType;
}

export type PrimitiveType =
  | "route"
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

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
}

export interface FunctionMetadata {
  id: string;
  name: string;
  description: string;
  type: "function";
  inputs: Input[];
  outputs: Output[];
  generatedCode: string;
  isCodeUpdated: boolean;
}

export interface RouteMetadata {
  id: string;
  name: string;
  description: string;
  type: "route";
  actionType: "retrieve" | "submit" | "modify" | "delete";
  urlPath: string;
}

export interface WorkflowMetadata {
  id: string;
  name: string;
  description: string;
  type: "workflow";
  triggerType: "webhook" | "schedule";
}

export type PrimitiveMetadata =
  | FunctionMetadata
  | RouteMetadata
  | WorkflowMetadata;
