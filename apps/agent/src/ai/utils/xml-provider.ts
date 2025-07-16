import { nanoid } from "@weldr/shared/nanoid";
import {
  type StreamTextResult,
  streamText,
  type TextStreamPart,
  type ToolSet,
} from "ai";
import type { z } from "zod";
import type { WorkflowContext } from "@/workflow/context";
import type { ZodXml } from "./zod-xml";

export interface XMLToolSpec<
  TName extends string = string,
  TParameters extends z.ZodSchema = z.ZodSchema,
  TResult = unknown,
> {
  name: TName;
  description: string;
  parameters: ZodXml<TParameters>;
  execute: (params: {
    input: z.infer<TParameters>;
    context: WorkflowContext;
  }) => Promise<TResult> | TResult;
  whenToUse: string;
}

// Helper type to extract the underlying Zod schema from ZodXml
type ExtractZodSchema<T> = T extends ZodXml<infer U> ? U : never;

// Stream part definitions
export type XMLTextDelta = {
  type: "text-delta";
  textDelta: string;
};

export type XMLToolCall<TTool extends XMLToolSpec> = {
  type: "tool-call";
  toolCallId: string;
  toolName: TTool["name"];
  args: z.infer<ExtractZodSchema<TTool["parameters"]>>;
};

export type XMLToolResult<TTool extends XMLToolSpec> = {
  type: "tool-result";
  toolCallId: string;
  toolName: TTool["name"];
  args: z.infer<ExtractZodSchema<TTool["parameters"]>>;
  result: Awaited<ReturnType<TTool["execute"]>>;
};

type AnyXMLToolCall<TTools extends readonly XMLToolSpec[]> = {
  [K in keyof TTools]: TTools[K] extends XMLToolSpec
    ? XMLToolCall<TTools[K]>
    : never;
}[number];

type AnyXMLToolResult<TTools extends readonly XMLToolSpec[]> = {
  [K in keyof TTools]: TTools[K] extends XMLToolSpec
    ? XMLToolResult<TTools[K]>
    : never;
}[number];

export type XMLStreamDelta<TTools extends readonly XMLToolSpec[]> =
  | XMLTextDelta
  | AnyXMLToolCall<TTools>
  | AnyXMLToolResult<TTools>;

export interface XMLStreamResult<TTools extends readonly XMLToolSpec[]>
  extends Omit<
    StreamTextResult<ToolSet, unknown>,
    "fullStream" | "toolCalls" | "toolResults"
  > {
  fullStream: AsyncIterable<XMLStreamDelta<TTools>>;
  toolCalls: Promise<AnyXMLToolCall<TTools>[]>;
  toolResults: Promise<AnyXMLToolResult<TTools>[]>;
}

export class XMLProvider<const TTools extends readonly XMLToolSpec[]> {
  private toolMap: Map<string, TTools[number]>;

  constructor(
    private tools: TTools,
    private context: WorkflowContext,
  ) {
    this.toolMap = new Map(tools.map((tool) => [tool.name, tool]));
  }

  streamText(
    parameters: Omit<Parameters<typeof streamText>[0], "tools">,
  ): XMLStreamResult<TTools> {
    const baseResult = streamText(parameters);
    const processor = new XMLStreamProcessor(this.toolMap, this.context);

    const fullStream = this.createFullStream(baseResult.fullStream, processor);

    return {
      ...baseResult,
      fullStream,
      toolCalls: processor.getToolCalls(),
      toolResults: processor.getToolResults(),
    };
  }

  private async *createFullStream(
    baseFullStream: AsyncIterable<TextStreamPart<ToolSet>>,
    processor: XMLStreamProcessor<TTools>,
  ): AsyncGenerator<XMLStreamDelta<TTools>> {
    for await (const delta of baseFullStream) {
      if (delta.type === "text-delta") {
        yield { type: "text-delta", textDelta: delta.textDelta };
        for await (const toolDelta of processor.processChunk(delta.textDelta)) {
          yield toolDelta;
        }
      }
    }

    for await (const finalDelta of processor.finalize()) {
      yield finalDelta;
    }
  }

  getSpecsMarkdown(): string {
    return this.tools
      .map((tool, index) => {
        const { name, description } = tool;
        const structure = tool.parameters.describe(name);
        return `${index + 1}.  **\`${name}\`**: ${description}\n    -   **When to use:** ${tool.whenToUse}\n    -   **Structure:**\n\`\`\`xml\n${structure}\n\`\`\``;
      })
      .join("\n\n");
  }
}

class XMLStreamProcessor<const TTools extends readonly XMLToolSpec[]> {
  private buffer = "";
  private toolCalls: AnyXMLToolCall<TTools>[] = [];
  private toolResults: AnyXMLToolResult<TTools>[] = [];
  private completedCallSignatures: Set<string> = new Set();
  private toolMap: Map<string, TTools[number]>;

  constructor(
    toolMap: Map<string, TTools[number]>,
    private context: WorkflowContext,
  ) {
    this.toolMap = toolMap;
  }

  async *processChunk(
    chunk: string,
  ): AsyncGenerator<AnyXMLToolCall<TTools> | AnyXMLToolResult<TTools>> {
    this.buffer += chunk;

    const rawCalls = this.robustXMLParse(this.buffer);

    for (const rawCall of rawCalls) {
      const callSignature = `${rawCall.name}:${rawCall.rawContent}`;

      if (this.completedCallSignatures.has(callSignature)) {
        continue;
      }
      this.completedCallSignatures.add(callSignature);

      const tool = this.toolMap.get(rawCall.name);
      if (!tool) continue;

      const toolCallId = nanoid();
      const parsedParams = tool.parameters.zSchema.safeParse(
        rawCall.parameters,
      );

      if (parsedParams.success) {
        const toolCall: XMLToolCall<typeof tool> = {
          type: "tool-call",
          toolCallId,
          toolName: tool.name,
          args: parsedParams.data,
        };
        this.toolCalls.push(toolCall as AnyXMLToolCall<TTools>);
        yield toolCall as AnyXMLToolCall<TTools>;

        const result = await this.executeTool(tool, toolCall);
        this.toolResults.push(result as AnyXMLToolResult<TTools>);
        yield result as AnyXMLToolResult<TTools>;
      } else {
        console.error("XML Parameter validation error", parsedParams.error);
      }
    }
  }

  private robustXMLParse(content: string): {
    name: string;
    parameters: Record<string, unknown>;
    rawContent: string;
  }[] {
    try {
      return this.parseXMLContent(content);
    } catch (error) {
      console.warn(
        "[XML PARSER] Initial parsing failed, attempting recovery:",
        error,
      );

      const cleaned = content
        .replace(/&(?!amp;|lt;|gt;|quot;|apos;)/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/&lt;(\/?[\w]+)&gt;/g, "<$1>");

      try {
        return this.parseXMLContent(cleaned);
      } catch (recoveryError) {
        console.warn("[XML PARSER] Recovery failed:", recoveryError);
        return this.fallbackParse(content);
      }
    }
  }

  private parseXMLContent(content: string): {
    name: string;
    parameters: Record<string, unknown>;
    rawContent: string;
  }[] {
    const toolCalls: {
      name: string;
      parameters: Record<string, unknown>;
      rawContent: string;
    }[] = [];
    const toolNames = Array.from(this.toolMap.keys());

    for (const toolName of toolNames) {
      const toolRegex = new RegExp(
        `<${toolName}\\s*>(.*?)<\\/${toolName}\\s*>`,
        "gis",
      );
      const matches = content.matchAll(toolRegex);

      for (const match of matches) {
        const innerContent = match[1]?.trim() || "";
        if (!innerContent) continue;

        const parameters = this.parseParameters(innerContent);
        toolCalls.push({
          name: toolName,
          parameters,
          rawContent: match[0],
        });
      }
    }
    return toolCalls;
  }

  private fallbackParse(content: string): {
    name: string;
    parameters: Record<string, unknown>;
    rawContent: string;
  }[] {
    const toolCalls: {
      name: string;
      parameters: Record<string, unknown>;
      rawContent: string;
    }[] = [];
    const toolNames = Array.from(this.toolMap.keys());

    for (const toolName of toolNames) {
      const patterns = [
        new RegExp(`<${toolName}>(.*?)<\\/${toolName}>`, "gis"),
        new RegExp(`<${toolName}>(.*?)<${toolName}>`, "gis"),
        new RegExp(`<${toolName}\\s*([^>]*?)\\s*\\/>`, "gis"),
      ];

      for (const pattern of patterns) {
        const matches = content.matchAll(pattern);
        for (const match of matches) {
          const innerContent = match[1]?.trim() ?? "";
          if (innerContent) {
            const parameters = this.parseParameters(innerContent);
            toolCalls.push({
              name: toolName,
              parameters,
              rawContent: match[0],
            });
          }
        }
      }
    }

    return toolCalls;
  }

  private parseParameters(content: string): Record<string, unknown> {
    try {
      return this.parseParametersCore(content);
    } catch (error) {
      console.warn(
        "[XML PARSER] Parameter parsing failed, attempting recovery:",
        error,
      );

      const cleanedContent = content
        .replace(/&(?!amp;|lt;|gt;|quot;|apos;)/g, "&amp;")
        .replace(/[\r\n\t]+/g, " ")
        .trim();

      try {
        return this.parseParametersCore(cleanedContent);
      } catch (recoveryError) {
        console.warn("[XML PARSER] Parameter recovery failed:", recoveryError);
        return { content: content.trim() };
      }
    }
  }

  private parseParametersCore(content: string): Record<string, unknown> {
    const parameterGroups: Record<string, string[]> = {};
    const paramRegex = /<(\w+)>(.*?)<\/\1>/gs;
    let paramMatch: RegExpExecArray | null;

    for (;;) {
      paramMatch = paramRegex.exec(content);
      if (paramMatch === null) {
        break;
      }
      const paramName = paramMatch[1];
      if (!paramName) continue;
      const paramValue = paramMatch[2];
      if (paramValue === undefined) continue;

      const camelCaseParamName = this.toCamelCase(paramName);
      if (!parameterGroups[camelCaseParamName]) {
        parameterGroups[camelCaseParamName] = [];
      }
      parameterGroups[camelCaseParamName]?.push(paramValue.trim());
    }

    if (Object.keys(parameterGroups).length === 0) {
      if (!/<\w+>/.test(content)) {
        return { value: content.trim() };
      }
    }

    const result: Record<string, unknown> = {};
    for (const [paramName, values] of Object.entries(parameterGroups)) {
      if (values.length === 1 && values[0] !== undefined) {
        const nestedObject = this.parseNestedObject(values[0]);
        if (nestedObject !== null) {
          result[paramName] = nestedObject;
        } else {
          // Check if value contains separators and should be parsed as array
          const processedValue = this.parseDelimitedValue(values[0]);
          result[paramName] = processedValue;
        }
      } else {
        result[paramName] = values.map((value) => {
          const nestedObject = this.parseNestedObject(value);
          if (nestedObject !== null) {
            return nestedObject;
          }
          return this.parseDelimitedValue(value);
        });
      }
    }
    return result;
  }

  private parseDelimitedValue(value: string): unknown {
    // Check for pipe separator first (primary separator)
    if (value.includes("|")) {
      const items = value
        .split("|")
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
      if (items.length > 1) {
        return this.processListItems(items);
      }
    }

    // Fall back to comma separator
    if (value.includes(",")) {
      const items = value
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
      if (items.length > 1) {
        return this.processListItems(items);
      }
    }

    // Try to convert single value to number only if it's an unquoted literal
    const trimmedValue = value.trim();
    if (
      (trimmedValue.startsWith('"') && trimmedValue.endsWith('"')) ||
      (trimmedValue.startsWith("'") && trimmedValue.endsWith("'"))
    ) {
      return trimmedValue.slice(1, -1); // Remove quotes but keep as string
    }

    const num = Number(trimmedValue);
    if (!Number.isNaN(num) && Number.isFinite(num) && trimmedValue !== "") {
      return num;
    }

    return value;
  }

  private processListItems(items: string[]): unknown[] {
    // Try to convert to numbers only if items are unquoted literals
    return items.map((item) => {
      // Don't convert quoted strings
      if (
        (item.startsWith('"') && item.endsWith('"')) ||
        (item.startsWith("'") && item.endsWith("'"))
      ) {
        return item.slice(1, -1); // Remove quotes but keep as string
      }

      // Convert unquoted numeric literals to numbers
      const num = Number(item);
      return !Number.isNaN(num) && Number.isFinite(num) ? num : item;
    });
  }

  private parseNestedObject(content: string): Record<string, unknown> | null {
    const nestedParams: Record<string, unknown> = {};
    const hasNestedTags = /<\w+>/.test(content);

    if (!hasNestedTags) {
      return null;
    }

    const paramRegex = /<(\w+)>(.*?)<\/\1>/gs;
    let paramMatch: RegExpExecArray | null;
    let foundParams = false;

    for (;;) {
      paramMatch = paramRegex.exec(content);
      if (paramMatch === null) {
        break;
      }
      const paramName = paramMatch[1];
      if (!paramName) continue;
      const paramValue = paramMatch[2];
      if (!paramValue) continue;

      foundParams = true;
      const camelCaseParamName = this.toCamelCase(paramName);

      const nestedObject = this.parseNestedObject(paramValue.trim());
      nestedParams[camelCaseParamName] =
        nestedObject !== null ? nestedObject : paramValue.trim();
    }

    return foundParams ? nestedParams : null;
  }

  private toCamelCase(str: string): string {
    return str.replace(/[-_]([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  private async executeTool<TCurrentTool extends TTools[number]>(
    tool: TCurrentTool,
    toolCall: XMLToolCall<TCurrentTool>,
  ): Promise<XMLToolResult<TCurrentTool>> {
    const result = await tool.execute({
      input: toolCall.args,
      context: this.context,
    });
    return {
      type: "tool-result",
      toolCallId: toolCall.toolCallId,
      toolName: tool.name,
      args: toolCall.args,
      result: result as Awaited<ReturnType<TCurrentTool["execute"]>>,
    };
  }

  async *finalize(): AsyncGenerator<
    AnyXMLToolCall<TTools> | AnyXMLToolResult<TTools>
  > {
    // In this implementation, finalize doesn't need to do anything with the buffer
    // as it is processed greedily. Can be extended for more complex scenarios.
  }

  getToolCalls(): Promise<AnyXMLToolCall<TTools>[]> {
    return Promise.resolve(this.toolCalls);
  }

  getToolResults(): Promise<AnyXMLToolResult<TTools>[]> {
    return Promise.resolve(this.toolResults);
  }
}
