import type { WorkflowContext } from "@/workflow/context";
import type { JSONSchema7, JSONSchema7Definition } from "json-schema";
import type { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { insertMessages } from "./insert-messages";

type Tool<
  TName extends string,
  TArgs extends z.ZodObject<z.ZodRawShape>,
  TOutput,
> = {
  name: TName;
  description: string;
  whenToUse: string;
  example: string;
  inputSchema: TArgs;
  execute: ({
    input,
    context,
  }: {
    input: z.infer<TArgs>;
    context: WorkflowContext;
  }) => Promise<TOutput> | TOutput;
};

type ParameterValue = string | Record<string, unknown> | ParameterValue[];

type RawToolCall = {
  name: string;
  parameters: Record<string, ParameterValue>;
};

export type ToolSpec = {
  name: string;
  description: string;
  whenToUse: string;
  example: string;
  parameters: JSONSchema7Definition | undefined;
};

export type ToolSuccess<T> = T extends {
  name: infer TName;
  inputSchema: infer TSchema;
  execute: infer TExecute;
}
  ? {
      name: TName;
      parameters: TSchema extends z.ZodObject<z.ZodRawShape>
        ? z.infer<TSchema>
        : never;
      result: TExecute extends (...args: unknown[]) => infer TResult
        ? Awaited<TResult>
        : never;
    }
  : never;

export type ToolError = {
  name: string;
  error: z.ZodError;
};

export type SomeToolResult<T extends readonly unknown[]> = {
  [K in keyof T]: ToolSuccess<T[K]>;
}[number];

export const defineTool = <
  TName extends string,
  TArgs extends z.ZodObject<z.ZodRawShape>,
  TOutput,
>(
  tool: Tool<TName, TArgs, TOutput>,
): typeof tool => tool;

export class ToolSet<
  TTools extends readonly {
    name: string;
    description: string;
    whenToUse: string;
    example: string;
    inputSchema: z.ZodObject<z.ZodRawShape>;
    execute: (...args: never[]) => unknown;
  }[],
> {
  private context: WorkflowContext;
  private toolMap: Map<string, TTools[number]>;
  private streamingBuffer = "";
  private processedToolCalls: Set<string> = new Set();

  constructor(
    context: WorkflowContext,
    private tools: TTools,
  ) {
    this.context = context;
    this.toolMap = new Map(tools.map((t) => [t.name, t]));
  }

  /**
   * Convert snake_case to camelCase
   */
  private toCamelCase(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  /**
   * Convert camelCase to snake_case
   */
  private toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  }

  getSpecs(): ToolSpec[] {
    return this.tools.map((tool) => {
      const { name, description, whenToUse, example, inputSchema } = tool;
      const jsonSchema = zodToJsonSchema(inputSchema) as JSONSchema7;

      // Convert property names to snake_case
      if (jsonSchema.properties) {
        const snakeCaseProperties: Record<string, JSONSchema7Definition> = {};
        for (const [key, value] of Object.entries(jsonSchema.properties)) {
          snakeCaseProperties[this.toSnakeCase(key)] = value;
        }
        jsonSchema.properties = snakeCaseProperties;

        // Update required array to use snake_case names
        if (jsonSchema.required) {
          jsonSchema.required = jsonSchema.required.map((key) =>
            this.toSnakeCase(key),
          );
        }
      }

      return {
        name,
        description,
        whenToUse,
        example,
        parameters: jsonSchema,
      };
    });
  }

  getSpecsMarkdown(): string {
    return this.getSpecs()
      .map((spec, index) => {
        const { name, description } = spec;
        const schema = spec.parameters as JSONSchema7;

        const parameters =
          schema?.properties && Object.keys(schema.properties).length > 0
            ? `
    -   **Parameters:**
${Object.entries(schema.properties)
  .map(([paramName, paramSchema]) => {
    const required = schema.required || [];
    const isOptional = !required.includes(paramName);
    const paramSchemaObj = paramSchema as JSONSchema7;
    return `        -   \`<${paramName}>\`: ${
      paramSchemaObj.description ?? `The ${paramName} for the tool.`
    }${isOptional ? " (optional)" : ""}${
      paramSchemaObj.default !== undefined
        ? ` (default: ${paramSchemaObj.default})`
        : ""
    }`;
  })
  .join("\n")}`
            : "";

        return `${index + 1}.  **\`${name}\`**: ${description}
    -   **When to use:** ${spec.whenToUse}${parameters}
    -   **Example:**
\`\`\`xml
${spec.example}
\`\`\``;
      })
      .join("\n\n");
  }

  /**
   * Reset streaming state for a new generation
   */
  resetStreamingState() {
    this.streamingBuffer = "";
    this.processedToolCalls.clear();
  }

  /**
   * Process a chunk of streaming content and execute any complete tool calls found
   */
  async processStreamingChunk(chunk: string): Promise<{
    newSuccesses: SomeToolResult<TTools>[];
    newErrors: ToolError[];
    hasToolCalls: boolean;
  }> {
    this.streamingBuffer += chunk;

    // Find complete tool calls that we haven't processed yet
    const completeCalls = this.parse(this.streamingBuffer);
    const newCalls = completeCalls.filter((call) => {
      const callId = `${call.name}-${JSON.stringify(call.parameters)}`;
      return !this.processedToolCalls.has(callId);
    });

    const newSuccesses: SomeToolResult<TTools>[] = [];
    const newErrors: ToolError[] = [];

    // Execute new tool calls
    for (const call of newCalls) {
      const callId = `${call.name}-${JSON.stringify(call.parameters)}`;
      this.processedToolCalls.add(callId);

      const tool = this.toolMap.get(call.name);
      if (!tool) continue;

      const parsed = tool.inputSchema.safeParse(call.parameters);

      if (parsed.success) {
        const result = await tool.execute({
          input: parsed.data,
          context: this.context,
        } as never);
        newSuccesses.push({
          name: tool.name,
          parameters: parsed.data,
          result,
        } as SomeToolResult<TTools>);
      } else {
        newErrors.push({ name: tool.name, error: parsed.error });
      }
    }

    // Determine if we have tool calls that should interrupt generation
    const hasToolCalls = newSuccesses.length > 0 || newErrors.length > 0;

    return { newSuccesses, newErrors, hasToolCalls };
  }

  private parse(content: string): RawToolCall[] {
    const toolCalls: RawToolCall[] = [];
    const toolNames = Array.from(this.toolMap.keys());

    console.log("[PARSE DEBUG] Content to parse:", content);
    console.log("[PARSE DEBUG] Tool names:", toolNames);

    // Create regex pattern that matches any known tool name
    for (const toolName of toolNames) {
      console.log("[PARSE DEBUG] Checking tool:", toolName);
      const toolRegex = new RegExp(`<${toolName}>(.*?)<\/${toolName}>`, "gs");
      const matches = content.matchAll(toolRegex);

      for (const match of matches) {
        console.log(`[PARSE DEBUG] Found match for ${toolName}:`, match[0]);
        const innerContent = match[1]?.trim() || "";
        console.log("[PARSE DEBUG] Inner content:", innerContent);

        const parameters = this.parseParameters(innerContent);

        console.log(
          `[PARSE DEBUG] Final parameters for ${toolName}:`,
          parameters,
        );
        toolCalls.push({ name: toolName, parameters });
      }
    }

    console.log("[PARSE DEBUG] Final tool calls:", toolCalls);
    return toolCalls;
  }

  /**
   * Parse parameters from XML content, handling both single values and arrays of objects
   */
  private parseParameters(content: string): Record<string, ParameterValue> {
    const parameterGroups: Record<string, string[]> = {};

    // First, collect all parameter instances (including duplicates)
    const paramRegex = /<(\w+)>(.*?)<\/\1>/gs;
    let paramMatch: RegExpExecArray | null;

    // biome-ignore lint/suspicious/noAssignInExpressions: This is a standard and efficient way to process regex matches.
    while ((paramMatch = paramRegex.exec(content)) !== null) {
      const [, paramName, paramValue] = paramMatch;
      if (paramName && paramValue) {
        const camelCaseParamName = this.toCamelCase(paramName);
        if (!parameterGroups[camelCaseParamName]) {
          parameterGroups[camelCaseParamName] = [];
        }
        parameterGroups[camelCaseParamName].push(paramValue.trim());
      }
    }

    console.log("[PARSE DEBUG] Parameter groups:", parameterGroups);

    // Process each parameter group
    const result: Record<string, ParameterValue> = {};
    for (const [paramName, values] of Object.entries(parameterGroups)) {
      if (values.length === 1 && values[0] !== undefined) {
        // Single value - check if it contains nested XML
        const nestedObject = this.parseNestedObject(values[0]);
        result[paramName] = nestedObject !== null ? nestedObject : values[0];
      } else {
        // Multiple values - create array
        result[paramName] = values.map((value) => {
          const nestedObject = this.parseNestedObject(value);
          return nestedObject !== null ? nestedObject : value;
        });
      }
    }

    return result;
  }

  /**
   * Parse nested XML object structure
   */
  private parseNestedObject(
    content: string,
  ): Record<string, ParameterValue> | null {
    const nestedParams: Record<string, ParameterValue> = {};
    const hasNestedTags = /<\w+>/.test(content);

    if (!hasNestedTags) {
      return null; // No nested structure, return as string
    }

    const paramRegex = /<(\w+)>(.*?)<\/\1>/gs;
    let paramMatch: RegExpExecArray | null;
    let foundParams = false;

    // biome-ignore lint/suspicious/noAssignInExpressions: This is a standard and efficient way to process regex matches.
    while ((paramMatch = paramRegex.exec(content)) !== null) {
      const [, paramName, paramValue] = paramMatch;
      if (paramName && paramValue) {
        foundParams = true;
        const camelCaseParamName = this.toCamelCase(paramName);

        // Check if this nested value also has nested structure
        const nestedObject = this.parseNestedObject(paramValue.trim());
        nestedParams[camelCaseParamName] =
          nestedObject !== null ? nestedObject : paramValue.trim();
      }
    }

    return foundParams ? nestedParams : null;
  }

  async handleToolErrors({
    errors,
    chatId,
    userId,
  }: {
    errors: ToolError[];
    chatId: string;
    userId: string;
  }) {
    for (const error of errors) {
      const errorMessage = `I tried to use the tool \`${error.name}\`, but I provided invalid parameters.
The tool returned the following errors:
\`\`\`json
${JSON.stringify(error.error.format(), null, 2)}
\`\`\`
Please analyze the error, correct the parameters for the \`${
        error.name
      }\` tool call, and provide a new plan.`;

      await insertMessages({
        input: {
          chatId,
          userId,
          messages: [
            {
              visibility: "internal",
              role: "assistant",
              content: [{ type: "text", text: errorMessage }],
            },
          ],
        },
      });
    }
  }

  async run(content: string): Promise<{
    successes: SomeToolResult<TTools>[];
    errors: ToolError[];
  }> {
    const rawCalls = this.parse(content);
    const successes: SomeToolResult<TTools>[] = [];
    const errors: ToolError[] = [];

    for (const call of rawCalls) {
      const tool = this.toolMap.get(call.name);
      if (!tool) continue;

      const parsed = tool.inputSchema.safeParse(call.parameters);

      if (parsed.success) {
        const result = await tool.execute({
          input: parsed.data,
          context: this.context,
        } as never);
        successes.push({
          name: tool.name,
          parameters: parsed.data,
          result,
        } as SomeToolResult<TTools>);
      } else {
        errors.push({ name: tool.name, error: parsed.error });
      }
    }

    return { successes, errors };
  }
}
