import type { WorkflowContext } from "@/workflow/context";
import { tool } from "ai";
import type { z } from "zod";

export function createTool<
  const TInput extends z.ZodType,
  const TOutput extends z.ZodType,
>({
  description,
  inputSchema,
  outputSchema,
  execute,
}: {
  description: string;
  inputSchema: TInput;
  outputSchema: TOutput;
  execute: (args: {
    input: z.infer<TInput>;
    context: WorkflowContext;
  }) => Promise<z.infer<TOutput>>;
}) {
  return (context: WorkflowContext) =>
    tool({
      description,
      parameters: inputSchema,
      execute: async (input: z.infer<TInput>): Promise<z.infer<TOutput>> => {
        return execute({ input, context });
      },
    });
}
