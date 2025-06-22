import { prompts } from "@/ai/prompts";
import {
  callCoderTool,
  initProjectTool,
  setupIntegrationTool,
  upgradeProjectTool,
} from "@/ai/tools";
import { getMessages } from "@/ai/utils/get-messages";
import { insertMessages } from "@/ai/utils/insert-messages";
import { registry } from "@/ai/utils/registry";
import { Logger } from "@/lib/logger";
import type { WorkflowContext } from "@/workflow/context";
import type {
  addMessageItemSchema,
  assistantMessageContentSchema,
  toolResultPartSchema,
} from "@weldr/shared/validators/chats";
import { streamText } from "ai";
import type { z } from "zod";
import { ToolSet } from "../utils/tools";

export async function plannerAgent({
  context,
  coolDownPeriod = 1000,
}: {
  context: WorkflowContext;
  coolDownPeriod?: number;
}) {
  const project = context.get("project");
  const user = context.get("user");
  const version = context.get("version");

  // Create contextual logger with base tags and extras
  const logger = Logger.get({
    tags: ["plannerAgent"],
    extra: {
      projectId: project.id,
      versionId: version.id,
    },
  });

  // Get the SSE stream writer from global connections
  const streamWriter = global.sseConnections?.get(version.chatId);

  if (!streamWriter) {
    throw new Error("Stream writer not found");
  }

  // Local function to execute planner agent and handle tool calls
  const executePlannerAgent = async (): Promise<boolean> => {
    let shouldRecur = false;
    const promptMessages = await getMessages(version.chatId);

    const toolSet = new ToolSet(context, [
      initProjectTool,
      upgradeProjectTool,
      setupIntegrationTool,
      callCoderTool,
    ]);

    // Reset streaming state for new generation
    toolSet.resetStreamingState();

    const result = await streamText({
      model: registry.languageModel("google:gemini-2.5-pro"),
      system: await prompts.planner(project, toolSet.getSpecsMarkdown()),
      messages: promptMessages,
      onError: (error) => {
        logger.error("Error in planner agent", {
          extra: { error },
        });
      },
    });

    let responseText = "";
    let wasInterrupted = false;
    const allSuccesses: Awaited<ReturnType<typeof toolSet.run>>["successes"] =
      [];
    const allErrors: Awaited<ReturnType<typeof toolSet.run>>["errors"] = [];

    // Process streaming chunks and execute tools incrementally
    for await (const chunk of result.textStream) {
      responseText += chunk;

      try {
        await streamWriter.write({ type: "text", text: chunk });
        logger.info("Chunk written successfully");
      } catch (error) {
        logger.error("Failed to write chunk", {
          extra: { error },
        });
      }

      // Process this chunk for tool calls
      const { newSuccesses, newErrors, hasToolCalls } =
        await toolSet.processStreamingChunk(chunk);

      // Add new results to our collections
      allSuccesses.push(...newSuccesses);
      allErrors.push(...newErrors);

      // Handle new tool executions
      if (newSuccesses.length > 0) {
        logger.info(
          `Executing tools during streaming: ${newSuccesses
            .map((t) => t.name)
            .join(", ")}`,
        );
      }

      // Handle errors immediately
      if (newErrors.length > 0) {
        await toolSet.handleToolErrors({
          errors: newErrors,
          chatId: version.chatId,
          userId: user.id,
        });
      }

      // Interrupt generation if tool calls were detected
      if (hasToolCalls) {
        logger.info("Tool calls detected, interrupting generation");
        wasInterrupted = true;
        break;
      }
    }

    // Prepare the assistant message content with proper structure
    const assistantContent: z.infer<typeof assistantMessageContentSchema>[] =
      [];

    // Add text content if any
    if (responseText.trim()) {
      assistantContent.push({
        type: "text",
        text: responseText,
      });
    }

    // Add tool calls to the message content
    for (const success of allSuccesses) {
      assistantContent.push({
        type: "tool-call",
        toolName: success.name,
        args: success.parameters as Record<string, unknown>,
      });
    }

    // Save messages using the proper schema structure
    const messagesToSave: z.infer<typeof addMessageItemSchema>[] = [];

    // Add assistant message if there's content
    if (assistantContent.length > 0) {
      messagesToSave.push({
        visibility: "public",
        role: "assistant",
        content: assistantContent,
      });
    }

    // Add tool results as separate tool messages
    if (allSuccesses.length > 0 || allErrors.length > 0) {
      const toolResults: z.infer<typeof toolResultPartSchema>[] = [
        ...allSuccesses.map((success) => ({
          type: "tool-result" as const,
          toolName: success.name,
          result: success.result,
          isError: false,
        })),
        ...allErrors.map((error) => ({
          type: "tool-result" as const,
          toolName: error.name,
          result: error.error,
          isError: true,
        })),
      ];

      const hasSetupIntegration = toolResults.some(
        (result) => result.toolName === "setup_integration",
      );
      const hasCallCoder = toolResults.some(
        (result) => result.toolName === "call_coder",
      );
      const visibility = hasSetupIntegration ? "public" : "internal";
      if (hasSetupIntegration || hasCallCoder) {
        return false;
      }

      messagesToSave.push({
        visibility,
        role: "tool",
        content: toolResults,
      });
    }

    // Save all messages
    if (messagesToSave.length > 0) {
      await insertMessages({
        input: {
          chatId: version.chatId,
          userId: user.id,
          messages: messagesToSave,
        },
      });
    }

    const finishReason = await result.finishReason;

    // Continue if generation was interrupted by tools or hit length limit
    if (wasInterrupted || finishReason === "length") {
      shouldRecur = true;
    }

    // Continue if we had any tool executions or errors
    if (allSuccesses.length > 0 || allErrors.length > 0) {
      shouldRecur = true;
    }

    return shouldRecur;
  };

  // Main execution loop for the planner agent
  let shouldContinue = true;
  while (shouldContinue) {
    shouldContinue = await executePlannerAgent();
    if (shouldContinue) {
      logger.info(`Recurring in ${coolDownPeriod}ms...`);
      await new Promise((resolve) => setTimeout(resolve, coolDownPeriod));
    }
  }

  logger.info("Planner agent completed");

  // End the stream
  await streamWriter.write({ type: "end" });
}
