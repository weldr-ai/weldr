import {
  type StreamTextResult,
  streamText,
  type TextStreamPart,
  type ToolSet,
} from "ai";
import type { z } from "zod";
import type { WorkflowContext } from "@/workflow/context";

import { Logger } from "@weldr/shared/logger";
import { nanoid } from "@weldr/shared/nanoid";
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

/**
 * Advanced type utility that extracts the underlying Zod schema from a ZodXml wrapper.
 * This is crucial for maintaining type safety when working with XML-wrapped schemas,
 * allowing us to infer the correct TypeScript types from the nested schema structure.
 */
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

/**
 * Complex mapped type that creates a union of all possible tool calls from a readonly array of XMLToolSpec.
 * This uses conditional types and mapped types to iterate over each tool in the array and create
 * the appropriate XMLToolCall type, then creates a union of all possibilities.
 */
type AnyXMLToolCall<TTools extends readonly XMLToolSpec[]> = {
  [K in keyof TTools]: TTools[K] extends XMLToolSpec
    ? XMLToolCall<TTools[K]>
    : never;
}[number];

/**
 * Similar to AnyXMLToolCall but for tool results. This ensures type safety across
 * all possible tool executions while maintaining the relationship between calls and results.
 */
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
  private logger: ReturnType<typeof Logger.get>;

  constructor(
    private tools: TTools,
    private context: WorkflowContext,
  ) {
    this.toolMap = new Map(tools.map((tool) => [tool.name, tool]));
    this.logger = Logger.get({ component: "XMLProvider" });
    this.logger.info(`Initialized XML provider with ${tools.length} tools`, {
      toolNames: tools.map((tool) => tool.name),
    });
  }

  streamText(
    parameters: Omit<Parameters<typeof streamText>[0], "tools">,
  ): XMLStreamResult<TTools> {
    this.logger.info("Starting XML stream text processing");

    const baseResult = streamText(parameters);
    const processor = new XMLStreamProcessor(this.toolMap, this.context);

    const fullStream = this.createFullStream(baseResult.fullStream, processor);

    this.logger.debug("XML stream text processing initialized");

    return {
      ...baseResult,
      fullStream,
      toolCalls: processor.getToolCalls(),
      toolResults: processor.getToolResults(),
    };
  }

  /**
   * Creates a full stream that processes both text deltas and XML tool calls in real-time.
   * This is a complex async generator that:
   * 1. Processes incoming text chunks from the base AI stream
   * 2. Parses XML tool calls as they appear in the stream
   * 3. Executes tools immediately when complete XML is detected
   * 4. Yields both text deltas and tool call/result events
   * 5. Handles errors gracefully while maintaining stream continuity
   */
  private async *createFullStream(
    baseFullStream: AsyncIterable<TextStreamPart<ToolSet>>,
    processor: XMLStreamProcessor<TTools>,
  ): AsyncGenerator<XMLStreamDelta<TTools>> {
    this.logger.debug("Starting full stream processing");
    let textChunkCount = 0;
    let toolDeltaCount = 0;

    try {
      for await (const delta of baseFullStream) {
        if (delta.type === "text-delta") {
          textChunkCount++;
          yield { type: "text-delta", textDelta: delta.textDelta };
          for await (const toolDelta of processor.processChunk(
            delta.textDelta,
          )) {
            toolDeltaCount++;
            yield toolDelta;
          }
        }
      }

      this.logger.debug("Processing final deltas");
      for await (const finalDelta of processor.finalize()) {
        toolDeltaCount++;
        yield finalDelta;
      }

      this.logger.info("Full stream processing completed", {
        textChunkCount,
        toolDeltaCount,
      });
    } catch (error) {
      this.logger.error("Full stream processing failed", {
        error: error instanceof Error ? error.message : String(error),
        textChunkCount,
        toolDeltaCount,
      });
      throw error;
    }
  }

  getSpecsMarkdown(): string {
    this.logger.debug("Generating tool specifications markdown", {
      toolCount: this.tools.length,
    });

    const specs = this.tools
      .map((tool, index) => {
        const { name, description } = tool;
        const parametersStructure = tool.parameters.describe("");
        const structure = `<tool_call>
<tool_name>${name}</tool_name>
<parameters>
${parametersStructure
  .split("\n")
  .map((line) => (line ? `  ${line}` : line))
  .join("\n")}
</parameters>
</tool_call>`;
        return `${index + 1}.  **\`${name}\`**: ${description}\n    -   **When to use:** ${tool.whenToUse}\n    -   **Structure:**\n\`\`\`xml\n${structure}\n\`\`\``;
      })
      .join("\n\n");

    this.logger.debug("Generated tool specifications markdown", {
      markdownLength: specs.length,
    });

    return specs;
  }
}

class XMLStreamProcessor<const TTools extends readonly XMLToolSpec[]> {
  private buffer = "";
  private toolCalls: AnyXMLToolCall<TTools>[] = [];
  private toolResults: AnyXMLToolResult<TTools>[] = [];
  private completedCallSignatures: Set<string> = new Set();
  private toolMap: Map<string, TTools[number]>;
  private logger: ReturnType<typeof Logger.get>;

  constructor(
    toolMap: Map<string, TTools[number]>,
    private context: WorkflowContext,
  ) {
    this.toolMap = toolMap;
    this.logger = Logger.get({ component: "XMLStreamProcessor" });
    this.logger.debug("Initialized XML stream processor", {
      availableTools: Array.from(toolMap.keys()),
    });
  }

  /**
   * Processes incoming text chunks and extracts/executes XML tool calls.
   * This is a complex streaming parser that:
   * 1. Accumulates text in a buffer as chunks arrive
   * 2. Attempts to parse complete XML tool calls from the buffer
   * 3. Validates parsed calls against available tools and schemas
   * 4. Executes valid tool calls asynchronously
   * 5. Prevents duplicate execution using call signatures
   * 6. Yields tool calls and results as they become available
   */
  async *processChunk(
    chunk: string,
  ): AsyncGenerator<AnyXMLToolCall<TTools> | AnyXMLToolResult<TTools>> {
    this.buffer += chunk;
    this.logger.debug("Processing chunk", {
      chunkLength: chunk.length,
      bufferLength: this.buffer.length,
    });

    const rawCalls = this.robustXMLParse(this.buffer);
    this.logger.debug("Parsed raw calls from buffer", {
      callCount: rawCalls.length,
    });

    for (const rawCall of rawCalls) {
      const callSignature = `${rawCall.name}:${rawCall.rawContent}`;

      if (this.completedCallSignatures.has(callSignature)) {
        this.logger.debug("Skipping duplicate call signature", {
          callSignature,
        });
        continue;
      }
      this.completedCallSignatures.add(callSignature);

      const tool = this.toolMap.get(rawCall.name);
      if (!tool) {
        this.logger.warn("Unknown tool requested", { toolName: rawCall.name });
        continue;
      }

      const toolCallId = nanoid();
      this.logger.debug("Processing tool call", {
        toolName: rawCall.name,
        toolCallId,
      });

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
        this.logger.info("Tool call validated successfully", {
          toolName: tool.name,
          toolCallId,
          args: parsedParams.data,
        });
        yield toolCall as AnyXMLToolCall<TTools>;

        try {
          const result = await this.executeTool(tool, toolCall);
          this.toolResults.push(result as AnyXMLToolResult<TTools>);
          this.logger.info("Tool executed successfully", {
            toolName: tool.name,
            toolCallId,
          });
          yield result as AnyXMLToolResult<TTools>;
        } catch (error) {
          this.logger.error("Tool execution failed", {
            toolName: tool.name,
            toolCallId,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          });
          throw error;
        }
      } else {
        this.logger.error("XML parameter validation failed", {
          toolName: rawCall.name,
          toolCallId,
          validationError: parsedParams.error.format(),
          rawParameters: rawCall.parameters,
        });
        yield {
          type: "tool-result",
          toolCallId,
          toolName: tool.name,
          args: {},
          result: {
            error: true,
            message: parsedParams.error.message,
            toolName: rawCall.name,
            originalXML: rawCall.rawContent,
            validationError: parsedParams.error.format(),
            rawParameters: rawCall.parameters,
          },
        } as AnyXMLToolResult<TTools>;
      }
    }
  }

  /**
   * Robust XML parsing with multiple fallback strategies.
   * This method implements a sophisticated error recovery system:
   * 1. First attempts standard XML parsing
   * 2. If that fails, cleans common XML encoding issues and retries
   * 3. If cleaning fails, uses a fallback parser with relaxed rules
   * 4. Each level provides increasingly permissive parsing while maintaining safety
   * This approach ensures maximum compatibility with varied AI model outputs.
   */
  private robustXMLParse(content: string): {
    name: string;
    parameters: Record<string, unknown>;
    rawContent: string;
  }[] {
    try {
      const result = this.parseXMLContent(content);
      this.logger.debug("XML parsing successful", { callCount: result.length });
      return result;
    } catch (error) {
      this.logger.warn("Initial XML parsing failed, attempting recovery", {
        error: error instanceof Error ? error.message : String(error),
        contentLength: content.length,
      });

      const cleaned = content
        .replace(/&(?!amp;|lt;|gt;|quot;|apos;)/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/&lt;(\/?[\w]+)&gt;/g, "<$1>");

      try {
        const result = this.parseXMLContent(cleaned);
        this.logger.info("XML parsing recovery successful", {
          callCount: result.length,
        });
        return result;
      } catch (recoveryError) {
        this.logger.warn("XML parsing recovery failed, using fallback parser", {
          recoveryError:
            recoveryError instanceof Error
              ? recoveryError.message
              : String(recoveryError),
          originalError: error instanceof Error ? error.message : String(error),
          contentLength: content.length,
        });
        const fallbackResult = this.fallbackParse(content);
        this.logger.debug("Fallback parser result", {
          callCount: fallbackResult.length,
        });
        return fallbackResult;
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

    // Parse standardized <tool_call> format
    const toolCallRegex = /<tool_call\s*>(.*?)<\/tool_call\s*>/gis;
    const matches = content.matchAll(toolCallRegex);

    for (const match of matches) {
      const innerContent = match[1]?.trim() || "";
      if (!innerContent) continue;

      // Extract tool_name
      const toolNameMatch = /<tool_name\s*>(.*?)<\/tool_name\s*>/is.exec(
        innerContent,
      );
      if (!toolNameMatch || !toolNameMatch[1]) continue;

      const toolName = toolNameMatch[1].trim();

      // Validate that this tool exists
      if (!this.toolMap.has(toolName)) continue;

      // Extract parameters
      const parametersMatch = /<parameters\s*>(.*?)<\/parameters\s*>/is.exec(
        innerContent,
      );
      let parameters: Record<string, unknown> = {};

      if (parametersMatch?.[1]) {
        parameters = this.parseParameters(parametersMatch[1].trim());
      }

      toolCalls.push({
        name: toolName,
        parameters,
        rawContent: match[0],
      });
    }

    return toolCalls;
  }

  /**
   * Fallback XML parser that handles malformed or incomplete XML.
   * This parser uses increasingly permissive regex patterns to handle:
   * 1. Malformed closing tags (missing `/` or wrong tag names)
   * 2. Self-closing tags that should contain content
   * 3. Incomplete XML structures from streaming AI responses
   * It prioritizes extracting usable data over strict XML compliance.
   */
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

    // Try fallback patterns for the standardized format
    const fallbackPatterns = [
      // Standard format with potential malformed closing tags
      /<tool_call\s*>(.*?)<\/tool_call>/gis,
      /<tool_call\s*>(.*?)<tool_call>/gis, // Malformed closing
      /<tool_call\s*([^>]*?)\s*\/>/gis, // Self-closing
    ];

    for (const pattern of fallbackPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        const innerContent = match[1]?.trim() ?? "";
        if (!innerContent) continue;

        // Extract tool_name with fallback patterns
        let toolName = "";
        const toolNamePatterns = [
          /<tool_name\s*>(.*?)<\/tool_name\s*>/is,
          /<tool_name\s*>(.*?)<tool_name>/is, // Malformed closing
          /<tool_name\s*([^>]*?)\s*\/>/is, // Self-closing
        ];

        for (const namePattern of toolNamePatterns) {
          const nameMatch = namePattern.exec(innerContent);
          if (nameMatch?.[1]) {
            toolName = nameMatch[1].trim();
            break;
          }
        }

        if (!toolName || !this.toolMap.has(toolName)) continue;

        // Extract parameters with fallback patterns
        let parameters: Record<string, unknown> = {};
        const paramPatterns = [
          /<parameters\s*>(.*?)<\/parameters\s*>/is,
          /<parameters\s*>(.*?)<parameters>/is, // Malformed closing
        ];

        for (const paramPattern of paramPatterns) {
          const paramMatch = paramPattern.exec(innerContent);
          if (paramMatch?.[1]) {
            parameters = this.parseParameters(paramMatch[1].trim());
            break;
          }
        }

        toolCalls.push({
          name: toolName,
          parameters,
          rawContent: match[0],
        });
      }
    }

    return toolCalls;
  }

  private parseParameters(content: string): Record<string, unknown> {
    try {
      const result = this.parseParametersCore(content);
      this.logger.debug("Parameter parsing successful", {
        parameterCount: Object.keys(result).length,
      });
      return result;
    } catch (error) {
      this.logger.warn("Parameter parsing failed, attempting recovery", {
        error: error instanceof Error ? error.message : String(error),
        contentLength: content.length,
      });

      const cleanedContent = content
        .replace(/&(?!amp;|lt;|gt;|quot;|apos;)/g, "&amp;")
        .replace(/[\r\n\t]+/g, " ")
        .trim();

      try {
        const result = this.parseParametersCore(cleanedContent);
        this.logger.info("Parameter parsing recovery successful", {
          parameterCount: Object.keys(result).length,
        });
        return result;
      } catch (recoveryError) {
        this.logger.warn("Parameter parsing recovery failed, using fallback", {
          recoveryError:
            recoveryError instanceof Error
              ? recoveryError.message
              : String(recoveryError),
          originalError: error instanceof Error ? error.message : String(error),
          contentLength: content.length,
        });
        return { content: content.trim() };
      }
    }
  }

  /**
   * Core parameter parsing logic that handles nested XML structures.
   * This method implements a sophisticated parsing algorithm that:
   * 1. Extracts all XML parameter tags using regex
   * 2. Groups parameters by name to handle arrays (multiple tags with same name)
   * 3. Converts parameter names to camelCase for JavaScript conventions
   * 4. Recursively parses nested XML structures
   * 5. Handles edge cases like single-key objects containing arrays
   * 6. Falls back to simple string parsing when no XML structure is found
   */
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
          /**
           * Special handling for single-key nested objects containing arrays.
           * This addresses cases like: <keys><key>val1</key><key>val2</key></keys>
           * Where we want: keys: ["val1", "val2"]
           * Instead of: keys: { key: ["val1", "val2"] }
           * This flattening improves usability for array-like structures.
           */
          const objectKeys = Object.keys(nestedObject);
          if (objectKeys.length === 1) {
            const singleKey = objectKeys[0];
            // biome-ignore lint/style/noNonNullAssertion: reason
            const singleValue = nestedObject[singleKey!];
            if (Array.isArray(singleValue)) {
              result[paramName] = singleValue;
              continue;
            }
          }
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

  /**
   * Parses delimited values with intelligent type conversion.
   * This method handles multiple delimiter types and provides smart type coercion:
   * 1. Primary delimiter: pipe (|) for explicit array values
   * 2. Fallback delimiter: comma (,) for CSV-like values
   * 3. Preserves quoted strings as strings (no number conversion)
   * 4. Converts unquoted numeric literals to numbers
   * 5. Maintains original strings for non-numeric values
   */
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

  /**
   * Recursively parses nested XML objects with sophisticated structure handling.
   * This method implements a recursive descent parser that:
   * 1. Detects nested XML tags within parameter values
   * 2. Groups parameters by name to handle repeated elements as arrays
   * 3. Recursively processes nested structures to arbitrary depth
   * 4. Handles mixed content (both nested objects and simple values)
   * 5. Returns null if no nested structure is detected, allowing fallback to simple parsing
   */
  private parseNestedObject(content: string): Record<string, unknown> | null {
    const nestedParams: Record<string, string[]> = {};
    const hasNestedTags = /<\w+>/.test(content);

    if (!hasNestedTags) {
      return null;
    }

    const paramRegex = /<(\w+)>(.*?)<\/\1>/gs;
    let paramMatch: RegExpExecArray | null;
    let foundParams = false;

    // First, collect all parameters, grouping by name
    for (;;) {
      paramMatch = paramRegex.exec(content);
      if (paramMatch === null) {
        break;
      }
      const paramName = paramMatch[1];
      if (!paramName) continue;
      const paramValue = paramMatch[2];
      if (paramValue === undefined) continue;

      foundParams = true;
      const camelCaseParamName = this.toCamelCase(paramName);

      if (!nestedParams[camelCaseParamName]) {
        nestedParams[camelCaseParamName] = [];
      }
      nestedParams[camelCaseParamName]?.push(paramValue.trim());
    }

    if (!foundParams) {
      return null;
    }

    // Process the grouped parameters
    const result: Record<string, unknown> = {};
    for (const [paramName, values] of Object.entries(nestedParams)) {
      if (values.length === 1 && values[0] !== undefined) {
        const nestedObject = this.parseNestedObject(values[0]);
        if (nestedObject !== null) {
          result[paramName] = nestedObject;
        } else {
          result[paramName] = values[0];
        }
      } else {
        // Multiple values - create an array
        result[paramName] = values.map((value) => {
          const nestedObject = this.parseNestedObject(value);
          return nestedObject !== null ? nestedObject : value;
        });
      }
    }

    return result;
  }

  private toCamelCase(str: string): string {
    return str.replace(/[-_]([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  private async executeTool<TCurrentTool extends TTools[number]>(
    tool: TCurrentTool,
    toolCall: XMLToolCall<TCurrentTool>,
  ): Promise<XMLToolResult<TCurrentTool>> {
    const startTime = Date.now();
    this.logger.debug("Starting tool execution", {
      toolName: tool.name,
      toolCallId: toolCall.toolCallId,
      args: toolCall.args,
    });

    try {
      const result = await tool.execute({
        input: toolCall.args,
        context: this.context,
      });

      const executionTime = Date.now() - startTime;
      this.logger.info("Tool execution completed", {
        toolName: tool.name,
        toolCallId: toolCall.toolCallId,
        executionTimeMs: executionTime,
      });

      return {
        type: "tool-result",
        toolCallId: toolCall.toolCallId,
        toolName: tool.name,
        args: toolCall.args,
        result: result as Awaited<ReturnType<TCurrentTool["execute"]>>,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logger.error("Tool execution failed", {
        toolName: tool.name,
        toolCallId: toolCall.toolCallId,
        executionTimeMs: executionTime,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
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
