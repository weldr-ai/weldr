import { Logger } from "@weldr/shared/logger";
import { nanoid } from "@weldr/shared/nanoid";

import type { WorkflowContext } from "@/workflow/context";
import type {
  AnyXMLToolCall,
  AnyXMLToolError,
  AnyXMLToolResult,
  MyToolSet,
  XMLTool,
  XMLToolCall,
  XMLToolError,
  XMLToolResult,
} from "../types";

export class XMLStreamProcessor<const TOOL_SET extends MyToolSet> {
  private buffer = "";
  private toolCalls: AnyXMLToolCall<TOOL_SET>[] = [];
  private toolResults: AnyXMLToolResult<TOOL_SET>[] = [];
  private completedCallSignatures: Set<string> = new Set();
  private toolSet: TOOL_SET;
  private logger: ReturnType<typeof Logger.get>;

  constructor(
    toolSet: TOOL_SET,
    private context: WorkflowContext,
  ) {
    this.toolSet = toolSet;
    this.logger = Logger.get({ component: "XMLStreamProcessor" });
    this.logger.debug("Initialized XML stream processor", {
      availableTools: Object.keys(this.toolSet),
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
  ): AsyncGenerator<
    | AnyXMLToolCall<TOOL_SET>
    | AnyXMLToolResult<TOOL_SET>
    | AnyXMLToolError<TOOL_SET>
  > {
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

      const tool = this.toolSet[rawCall.name]?.asXML(this.context);
      if (!tool) {
        this.logger.warn("Unknown tool requested", { toolName: rawCall.name });
        continue;
      }

      const toolCallId = nanoid();
      this.logger.debug("Processing tool call", {
        toolName: rawCall.name,
        toolCallId,
      });

      const parsedParams = tool.inputSchema.zSchema.safeParse(
        rawCall.parameters,
      );

      if (parsedParams.success) {
        const toolCall: XMLToolCall<typeof tool> = {
          type: "tool-call",
          toolCallId,
          toolName: tool.name,
          input: parsedParams.data,
        };
        this.toolCalls.push(toolCall as AnyXMLToolCall<TOOL_SET>);
        this.logger.info("Tool call validated successfully", {
          toolName: tool.name,
          toolCallId,
          input: parsedParams.data,
        });
        yield toolCall as AnyXMLToolCall<TOOL_SET>;

        try {
          const result = await this.executeTool(tool, toolCall);
          this.toolResults.push(result as AnyXMLToolResult<TOOL_SET>);
          this.logger.info("Tool executed successfully", {
            toolName: tool.name,
            toolCallId,
          });
          yield result as AnyXMLToolResult<TOOL_SET>;
        } catch (error) {
          this.logger.error("Tool execution failed", {
            toolName: tool.name,
            toolCallId,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          });

          const toolError: XMLToolError<typeof tool> = {
            type: "tool-error",
            toolCallId,
            toolName: tool.name,
            input: toolCall.input,
            error,
          };
          yield toolError as AnyXMLToolError<TOOL_SET>;
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
          input: {},
          output: {
            error: true,
            message: parsedParams.error.message,
            toolName: rawCall.name,
            originalXML: rawCall.rawContent,
            validationError: parsedParams.error.format(),
            rawParameters: rawCall.parameters,
          },
        } as AnyXMLToolResult<TOOL_SET>;
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
      if (!this.toolSet[toolName]) continue;

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

        if (!toolName || !this.toolSet[toolName]) continue;

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
          const processedValue = this.parseValue(values[0]);
          result[paramName] = processedValue;
        }
      } else {
        result[paramName] = values.map((value) => {
          const nestedObject = this.parseNestedObject(value);
          if (nestedObject !== null) {
            return nestedObject;
          }
          return this.parseValue(value);
        });
      }
    }
    return result;
  }

  /**
   * Simple value processing with basic type conversion.
   * This method handles basic type coercion:
   * 1. Preserves quoted strings as strings (no number conversion)
   * 2. Converts unquoted numeric literals to numbers
   * 3. Maintains original strings for all other values
   */
  private parseValue(value: string): unknown {
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

  private async executeTool<TCurrentTool extends XMLTool>(
    tool: TCurrentTool,
    toolCall: XMLToolCall<TCurrentTool>,
  ): Promise<XMLToolResult<TCurrentTool>> {
    const startTime = Date.now();
    this.logger.debug("Starting tool execution", {
      toolName: tool.name,
      toolCallId: toolCall.toolCallId,
      input: toolCall.input,
    });

    try {
      const result = await tool.execute(toolCall.input);

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
        input: toolCall.input,
        output: result as Awaited<ReturnType<TCurrentTool["execute"]>>,
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
      return {
        type: "tool-result",
        toolCallId: toolCall.toolCallId,
        toolName: tool.name,
        input: toolCall.input,
        output: (error instanceof Error
          ? { message: error.message }
          : { message: JSON.stringify(error) }) as Awaited<
          ReturnType<TCurrentTool["execute"]>
        >,
      };
    }
  }

  async *finalize(): AsyncGenerator<
    | AnyXMLToolCall<TOOL_SET>
    | AnyXMLToolResult<TOOL_SET>
    | AnyXMLToolError<TOOL_SET>
  > {
    // In this implementation, finalize doesn't need to do anything with the buffer
    // as it is processed greedily. Can be extended for more complex scenarios.
  }

  getToolCalls(): Promise<AnyXMLToolCall<TOOL_SET>[]> {
    return Promise.resolve(this.toolCalls);
  }

  getToolResults(): Promise<AnyXMLToolResult<TOOL_SET>[]> {
    return Promise.resolve(this.toolResults);
  }
}
