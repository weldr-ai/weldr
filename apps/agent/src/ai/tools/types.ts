import type { StreamTextResult, Tool, ToolSet } from "ai";
import type { z } from "zod";

import type { WorkflowContext } from "@/workflow/context";
import type { ZodXML } from "./xml/zod";

export type ToolConfig<
  TName extends string,
  TInput extends z.ZodSchema,
  TOutput extends z.ZodSchema,
> = {
  name: TName;
  description: string;
  whenToUse: string;
  inputSchema: TInput;
  outputSchema: TOutput;
  execute?: (params: {
    input: z.infer<TInput>;
    context: WorkflowContext;
  }) => Promise<z.infer<TOutput>> | undefined;
};

/**
 * Type-safe tool set that preserves exact tool names and types.
 * This ensures complete type safety when working with specific tool sets.
 * Each tool can have its own specific input and output types.
 */

export interface XMLTool<
  TName extends string = string,
  TInput extends z.ZodSchema = z.ZodSchema,
  TOutput extends z.ZodSchema = z.ZodSchema,
> {
  name: TName;
  description: string;
  inputSchema: ZodXML<TInput>;
  outputSchema: TOutput;
  execute: (input: z.infer<TInput>) => Promise<z.infer<TOutput>>;
  toMarkdown: () => string;
}

/**
 * Advanced type utility that extracts the underlying Zod schema from a ZodXml wrapper.
 * This is crucial for maintaining type safety when working with XML-wrapped schemas,
 * allowing us to infer the correct TypeScript types from the nested schema structure.
 */
type ExtractZodSchema<T> = T extends ZodXML<infer U> ? U : never;

// Stream part definitions
export type XMLTextDelta = {
  type: "text-delta";
  text: string;
};

export type XMLReasoningDelta = {
  type: "reasoning-delta";
  text: string;
};

export type XMLToolCall<TOOL extends XMLTool> = {
  type: "tool-call";
  toolCallId: string;
  toolName: TOOL["name"];
  input: z.infer<ExtractZodSchema<TOOL["inputSchema"]>>;
};

export type XMLToolResult<TOOL extends XMLTool> = {
  type: "tool-result";
  toolCallId: string;
  toolName: TOOL["name"];
  input: z.infer<ExtractZodSchema<TOOL["inputSchema"]>>;
  output: z.infer<TOOL["outputSchema"]>;
};

export type XMLToolError<TOOL extends XMLTool> = {
  type: "tool-error";
  toolCallId: string;
  toolName: TOOL["name"];
  input: z.infer<ExtractZodSchema<TOOL["inputSchema"]>>;
  error: unknown;
};

/**
 * Complex mapped type that creates a union of all possible tool calls from a MyToolSet.
 * This uses conditional types and mapped types to iterate over each tool in the record and create
 * the appropriate XMLToolCall type, then creates a union of all possibilities.
 */
export type AnyXMLToolCall<TOOLS extends MyToolSet> = {
  [K in keyof TOOLS]: XMLToolCall<ReturnType<TOOLS[K]["asXML"]>>;
}[keyof TOOLS];

/**
 * Similar to AnyXMLToolCall but for tool results. This ensures type safety across
 * all possible tool executions while maintaining the relationship between calls and results.
 */
export type AnyXMLToolResult<TOOLS extends MyToolSet> = {
  [K in keyof TOOLS]: XMLToolResult<ReturnType<TOOLS[K]["asXML"]>>;
}[keyof TOOLS];

/**
 * Similar to AnyXMLToolResult but for tool errors. This ensures type safety across
 * all possible tool execution errors while maintaining the relationship between calls and errors.
 */
export type AnyXMLToolError<TOOLS extends MyToolSet> = {
  [K in keyof TOOLS]: XMLToolError<ReturnType<TOOLS[K]["asXML"]>>;
}[keyof TOOLS];

export type XMLStreamDelta<TOOLS extends MyToolSet> =
  | XMLTextDelta
  | XMLReasoningDelta
  | AnyXMLToolCall<TOOLS>
  | AnyXMLToolResult<TOOLS>
  | AnyXMLToolError<TOOLS>;

export interface XMLStreamResult<TOOLS extends MyToolSet>
  extends Omit<
    StreamTextResult<ToolSet, unknown>,
    "fullStream" | "toolCalls" | "toolResults"
  > {
  fullStream: AsyncIterable<XMLStreamDelta<TOOLS>>;
  toolCalls: Promise<AnyXMLToolCall<TOOLS>[]>;
  toolResults: Promise<AnyXMLToolResult<TOOLS>[]>;
}

export interface MyTool<
  TName extends string = string,
  TInput extends z.ZodSchema = z.ZodSchema,
  TOutput extends z.ZodSchema = z.ZodSchema,
> {
  (context: WorkflowContext): Tool<TInput, TOutput>;
  asXML: (context: WorkflowContext) => XMLTool<TName, TInput, TOutput>;
  toMarkdown: () => string;
}

export type MyToolSet<
  TName extends string = string,
  TInput extends z.ZodSchema = z.ZodSchema,
  TOutput extends z.ZodSchema = z.ZodSchema,
  TOOL extends MyTool<TName, z.infer<TInput>, z.infer<TOutput>> = MyTool<
    TName,
    z.infer<TInput>,
    z.infer<TOutput>
  >,
> = Record<TName, TOOL>;
