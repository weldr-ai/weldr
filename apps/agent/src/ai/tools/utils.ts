import type { Tool } from "ai";
import type { z } from "zod";

import type { WorkflowContext } from "@/workflow/context";
import type { ToolConfig } from "./types";
import { ZodXML } from "./xml/zod";

/**
 * Creates a unified tool that works in both JSON and XML modes
 */
export function createTool<
  TName extends string,
  TInput extends z.ZodSchema,
  TOutput extends z.ZodSchema,
>(config: ToolConfig<TName, TInput, TOutput>) {
  // Return AI SDK tool format by default
  const aiSDKTool = (context: WorkflowContext): Tool => ({
    name: config.name,
    description: config.description,
    inputSchema: config.inputSchema,
    outputSchema: config.outputSchema,
    execute: config.execute
      ? async (input: z.infer<TInput>) => config.execute?.({ input, context })
      : undefined,
  });

  // Add XML tool format as a method
  aiSDKTool.asXML = (context: WorkflowContext) => ({
    name: config.name,
    description: config.description,
    inputSchema: new ZodXML(config.inputSchema),
    outputSchema: config.outputSchema,
    execute: config.execute
      ? async (input: z.infer<TInput>) => config.execute?.({ input, context })
      : undefined,
    toMarkdown: () => {
      return aiSDKTool.toMarkdown();
    },
  });

  aiSDKTool.toMarkdown = () => {
    const { name, description, whenToUse, inputSchema } = config;
    const parameters = new ZodXML(inputSchema);
    const parametersStructure = parameters.describe("");
    const structure = `<tool_call>
<tool_name>${name}</tool_name>
<parameters>
${parametersStructure
  .split("\n")
  .map((line) => (line ? `  ${line}` : line))
  .join("\n")}
</parameters>
</tool_call>`;
    return `**\`${name}\`**: ${description}\n    -   **When to use:** ${whenToUse}\n    -   **Structure:**\n\`\`\`xml\n${structure}\n\`\`\``;
  };

  return aiSDKTool;
}
