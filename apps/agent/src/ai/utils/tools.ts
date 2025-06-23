import type { WorkflowContext } from "@/workflow/context";
import type { z } from "zod";

export type ToolConfig<
  TName extends string,
  TArgs extends z.ZodObject<z.ZodRawShape>,
  TOutput,
> = {
  name: TName;
  description: string;
  whenToUse: string;
  example: string;
  inputSchema: TArgs;
  outputSchema?: z.ZodSchema;
  execute: (params: {
    input: z.infer<TArgs>;
    context: WorkflowContext;
  }) => Promise<TOutput>;
};

/**
 * Creates a unified tool that works in both JSON and XML modes
 */
export function createTool<
  TName extends string,
  TArgs extends z.ZodObject<z.ZodRawShape>,
  TOutput,
>(config: ToolConfig<TName, TArgs, TOutput>) {
  // Return AI SDK tool format by default
  const aiSDKTool = (context: WorkflowContext) => ({
    description: config.description,
    parameters: config.inputSchema,
    execute: async (input: z.infer<TArgs>) =>
      config.execute({ input, context }),
  });

  // Add XML tool format as a method
  aiSDKTool.getXML = () => ({
    name: config.name,
    description: config.description,
    whenToUse: config.whenToUse,
    example: config.example,
    parameters: config.inputSchema,
    outputSchema: config.outputSchema,
    execute: config.execute,
  });

  return aiSDKTool;
}
