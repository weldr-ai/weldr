import { z } from "zod";

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
  type: "function";
  inputs: Input[];
  outputs: Output[];
  generatedCode?: string;
  isCodeUpdated?: boolean;
}

export interface RouteMetadata {
  type: "route";
  actionType: "retrieve" | "submit" | "modify" | "delete";
  urlPath: string;
}

export interface WorkflowMetadata {
  type: "workflow";
  triggerType: "webhook" | "schedule";
}

const primitiveMetadata = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("function"),
    inputs: z
      .object({ name: z.string(), type: z.enum(["number", "text"]) })
      .array(),
    outputs: z
      .object({ name: z.string(), type: z.enum(["number", "text"]) })
      .array(),
    generatedCode: z.string().optional(),
    isCodeUpdated: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("route"),
    actionType: z.enum(["retrieve", "submit", "modify", "delete"]),
    urlPath: z.string(),
  }),
  z.object({
    type: z.literal("workflow"),
    triggerType: z.enum(["webhook", "schedule"]),
  }),
]);

export type PrimitiveMetadata = z.infer<typeof primitiveMetadata>;
