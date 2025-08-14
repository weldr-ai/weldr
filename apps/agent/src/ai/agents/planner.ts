import { streamText, type ToolSet } from "ai";
import type z from "zod";

import { Logger } from "@weldr/shared/logger";
import { nanoid } from "@weldr/shared/nanoid";
import type { addMessageItemSchema } from "@weldr/shared/validators/chats";

import { prompts } from "@/ai/prompts";
import {
  addIntegrationsTool,
  callCoderTool,
  findTool,
  fzfTool,
  grepTool,
  listDirTool,
  readFileTool,
  searchCodebaseTool,
} from "@/ai/tools";
import { getMessages } from "@/ai/utils/get-messages";
import { registry } from "@/ai/utils/registry";
import { stream } from "@/lib/stream-utils";
import { workflow } from "@/workflow";
import type { WorkflowContext } from "@/workflow/context";
import { queryRelatedDeclarationsTool } from "../tools/query-related-declarations";
import { insertMessages } from "../utils/insert-messages";
import { calculateModelCost } from "../utils/providers-pricing";

export async function plannerAgent({
  context,
  coolDownPeriod = 100,
}: {
  context: WorkflowContext;
  coolDownPeriod?: number;
}): Promise<void> {
  const project = context.get("project");
  const user = context.get("user");
  const version = context.get("version");

  const logger = Logger.get({
    projectId: project.id,
    versionId: version.id,
  });

  const tools: ToolSet = {
    list_dir: listDirTool(context),
    read_file: readFileTool(context),
    search_codebase: searchCodebaseTool(context),
    query_related_declarations: queryRelatedDeclarationsTool(context),
    fzf: fzfTool(context),
    grep: grepTool(context),
    find: findTool(context),
    call_coder: callCoderTool(context),
    add_integrations: addIntegrationsTool(context),
  };

  const system = await prompts.planner(project);

  // Local function to execute planner agent and handle tool calls
  const executePlannerAgent = async (): Promise<{
    shouldRecur: boolean;
    callingCoder: boolean;
  }> => {
    let shouldRecur = false;
    let callingCoder = false;
    const promptMessages = await getMessages(version.chatId);

    logger.info("promptMessages", {
      extra: { promptMessages },
    });

    const result = streamText({
      model: registry.languageModel("google:gemini-2.5-pro"),
      system,
      tools,
      messages: promptMessages,
      onError: (error) => {
        logger.error("Error in planner agent", {
          extra: { error },
        });
      },
    });

    const messageId = nanoid();

    for await (const part of result.fullStream) {
      switch (part.type) {
        case "text-delta": {
          await stream(version.chatId, {
            id: messageId,
            type: "text",
            text: part.text,
          });
          break;
        }
        case "tool-result": {
          if (part.toolName === "call_coder") {
            callingCoder = true;
          }

          if (
            part.toolName === "list_dir" ||
            part.toolName === "read_file" ||
            part.toolName === "search_codebase" ||
            part.toolName === "query_related_declarations" ||
            part.toolName === "fzf" ||
            part.toolName === "grep" ||
            part.toolName === "find"
          ) {
            shouldRecur = true;
          }

          if (part.toolName === "add_integrations") {
            await stream(version.chatId, {
              type: "tool",
              message: {
                id: nanoid(),
                createdAt: new Date(),
                chatId: version.chatId,
                role: "tool",
                content: [
                  {
                    type: "tool-result",
                    toolCallId: part.toolCallId,
                    toolName: part.toolName,
                    output: {
                      type: "json",
                      value: part.output,
                    },
                  },
                ],
              },
            });
            shouldRecur = false;
          }
          break;
        }
        case "tool-error": {
          shouldRecur = true;
          break;
        }
      }
    }

    const usage = await result.usage;

    const cost = await calculateModelCost(
      "google:gemini-2.5-pro",
      usage?.inputTokens ?? 0,
      usage?.outputTokens ?? 0,
    );

    const finishReason = await result.finishReason;

    const fullResponse = await result.response;

    const messagesToSave: z.infer<typeof addMessageItemSchema>[] = [];

    for (const message of fullResponse.messages) {
      switch (message.role) {
        case "assistant": {
          messagesToSave.push({
            role: "assistant",
            content: Array.isArray(message.content)
              ? message.content
              : [{ type: "text", text: message.content }],
            metadata: {
              provider: "google",
              model: "gemini-2.5-pro",
              inputTokens: usage?.inputTokens,
              outputTokens: usage?.outputTokens,
              totalTokens: usage?.totalTokens,
              inputCost: cost?.inputCost,
              outputCost: cost?.outputCost,
              totalCost: cost?.totalCost,
              inputTokensPrice: cost?.inputTokensPrice,
              outputTokensPrice: cost?.outputTokensPrice,
              inputImagesPrice: cost?.inputImagesPrice,
              finishReason,
            },
            createdAt: new Date(),
          });
          break;
        }
        case "tool": {
          messagesToSave.push({
            ...message,
            createdAt: new Date(),
          });
          break;
        }
      }
    }

    await insertMessages({
      input: {
        chatId: version.chatId,
        userId: user.id,
        messages: messagesToSave,
      },
    });

    return { shouldRecur, callingCoder };
  };

  // Main execution loop for the planner agent
  let shouldContinue = true;
  let iterationCount = 0;
  while (shouldContinue) {
    iterationCount++;
    logger.info(`Starting planner agent iteration ${iterationCount}`);
    const { shouldRecur, callingCoder } = await executePlannerAgent();

    shouldContinue = shouldRecur;

    if (shouldContinue) {
      logger.info(`Recurring in ${coolDownPeriod}ms...`);
      await new Promise((resolve) => setTimeout(resolve, coolDownPeriod));
    }

    if (!shouldContinue && !callingCoder) {
      workflow.suspend();
    }
  }

  logger.info("Planner agent completed");
}
