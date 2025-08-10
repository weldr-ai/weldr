import { streamText, type TextStreamPart, type ToolSet } from "ai";

import { Logger } from "@weldr/shared/logger";

import type { WorkflowContext } from "@/workflow/context";
import type { MyToolSet, XMLStreamDelta, XMLStreamResult } from "../types";
import { XMLStreamProcessor } from "./stream-processor";

export class XMLProvider<const TOOL_SET extends MyToolSet> {
  private toolSet: TOOL_SET;
  private logger: ReturnType<typeof Logger.get>;

  constructor(
    toolSet: TOOL_SET,
    private context: WorkflowContext,
  ) {
    this.toolSet = toolSet;
    this.logger = Logger.get({ component: "XMLProvider" });
    this.logger.info(
      `Initialized XML provider with ${Object.keys(toolSet).length} tools`,
      {
        toolNames: Object.keys(toolSet),
      },
    );
  }

  streamText(
    parameters: Parameters<typeof streamText>[0],
  ): XMLStreamResult<TOOL_SET> {
    this.logger.info("Starting XML stream text processing");

    const baseResult = streamText({
      ...parameters,
      tools: Object.entries(this.toolSet).reduce((acc, [name, tool]) => {
        acc[name] = tool(this.context);
        return acc;
      }, {} as ToolSet),
    });
    const processor = new XMLStreamProcessor(this.toolSet, this.context);

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
    processor: XMLStreamProcessor<TOOL_SET>,
  ): AsyncGenerator<XMLStreamDelta<TOOL_SET>> {
    this.logger.debug("Starting full stream processing");
    let textChunkCount = 0;
    let toolDeltaCount = 0;
    let otherDeltaCount = 0;

    try {
      for await (const delta of baseFullStream) {
        if (delta.type === "text-delta") {
          textChunkCount++;
          yield { type: "text-delta", text: delta.text };
          for await (const toolDelta of processor.processChunk(delta.text)) {
            toolDeltaCount++;
            yield toolDelta;
          }
        } else {
          otherDeltaCount++;
          yield delta as XMLStreamDelta<TOOL_SET>;
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
        otherDeltaCount,
      });
    } catch (error) {
      this.logger.error("Full stream processing failed", {
        error: error instanceof Error ? error.message : String(error),
        textChunkCount,
        toolDeltaCount,
        otherDeltaCount,
      });
      throw error;
    }
  }
}
