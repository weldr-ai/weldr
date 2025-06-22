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

    const result = await streamText({
      model: registry.languageModel("google:gemini-2.5-pro"),
      system: await prompts.planner(project),
      tools: {
        initProject: initProjectTool(context),
        upgradeProject: upgradeProjectTool(context),
        setupIntegration: setupIntegrationTool(context),
        callCoder: callCoderTool(context),
      },
      messages: promptMessages,
      onError: (error) => {
        logger.error("Error in planner agent", {
          extra: { error },
        });
      },
    });

    const toolResults: z.infer<typeof toolResultPartSchema>[] = [];

    // Create assistant message content to maintain proper order
    const assistantContent: z.infer<typeof assistantMessageContentSchema>[] =
      [];

    // Process the stream and handle tool calls
    for await (const delta of result.fullStream) {
      if (delta.type === "text-delta") {
        // Stream text content to SSE
        await streamWriter.write({
          type: "text",
          text: delta.textDelta,
        });

        // Add text content immediately to maintain proper order
        const lastItem = assistantContent[assistantContent.length - 1];
        if (lastItem && lastItem.type === "text") {
          // Append to existing text item
          lastItem.text += delta.textDelta;
        } else {
          // Create new text item
          assistantContent.push({
            type: "text",
            text: delta.textDelta,
          });
        }
      } else if (delta.type === "tool-call") {
        // Handle tool calls - add them as they come in to maintain order
        assistantContent.push({
          type: "tool-call",
          toolCallId: delta.toolCallId,
          toolName: delta.toolName,
          args: delta.args,
        });

        // Check if initProject or upgradeProject tools were called
        if (
          delta.toolName === "initProject" ||
          delta.toolName === "upgradeProject"
        ) {
          shouldRecur = true;
        }
      } else if (delta.type === "tool-result") {
        if (delta.toolName === "setupIntegration") {
          await streamWriter.write({
            type: "tool",
            toolName: "setupIntegration",
            toolCallId: delta.toolCallId,
            toolArgs: delta.args,
            toolResult: {
              status: "pending",
            },
          });
        }

        // Handle tool results
        toolResults.push({
          type: "tool-result",
          toolCallId: delta.toolCallId,
          toolName: delta.toolName,
          result: delta.result,
        });
      }
    }

    // Prepare messages to store
    const messagesToSave: z.infer<typeof addMessageItemSchema>[] = [];

    // Add assistant message
    if (assistantContent.length > 0) {
      messagesToSave.push({
        visibility: "public",
        role: "assistant",
        content: assistantContent,
      });
    }

    // Add tool results
    if (toolResults.length > 0) {
      messagesToSave.push({
        visibility: "internal",
        role: "tool",
        content: toolResults,
      });
    }

    // Store messages if any
    if (messagesToSave.length > 0) {
      await insertMessages({
        input: {
          chatId: version.chatId,
          userId: user.id,
          messages: messagesToSave,
        },
      });
    }

    return shouldRecur;
  };

  // Main execution loop for the planner agent
  let shouldContinue = true;
  let iterationCount = 0;
  while (shouldContinue) {
    iterationCount++;
    logger.info(`Starting planner agent iteration ${iterationCount}`);
    shouldContinue = await executePlannerAgent();
    if (shouldContinue) {
      logger.info(`Recurring in ${coolDownPeriod}ms...`);
      await new Promise((resolve) => setTimeout(resolve, coolDownPeriod));
    }
  }

  logger.info("Planner agent completed");

  // Signal that planner agent is complete - workflow will take over streaming
  logger.info(
    "Planner agent completed, transitioning to workflow progress updates",
  );
}
