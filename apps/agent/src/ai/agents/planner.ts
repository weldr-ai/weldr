import type { z } from "zod";
import { prompts } from "@/ai/prompts";
import {
  callCoderTool,
  findTool,
  fzfTool,
  grepTool,
  listDirTool,
  readFileTool,
  searchCodebaseTool,
} from "@/ai/tools";
import { getMessages } from "@/ai/utils/get-messages";
import { insertMessages } from "@/ai/utils/insert-messages";
import { registry } from "@/ai/utils/registry";
import type { WorkflowContext } from "@/workflow/context";

import { Logger } from "@weldr/shared/logger";
import type {
  addMessageItemSchema,
  assistantMessageContentSchema,
} from "@weldr/shared/validators/chats";
import { queryRelatedDeclarationsTool } from "../tools/query-related-declarations";
import { XMLProvider } from "../tools/xml/provider";
import { calculateModelCost } from "../utils/providers-pricing";

export async function plannerAgent({
  context,
  coolDownPeriod = 1000,
}: {
  context: WorkflowContext;
  coolDownPeriod?: number;
}): Promise<void> {
  const project = context.get("project");
  const user = context.get("user");
  const version = context.get("version");
  const isXML = context.get("isXML");

  const logger = Logger.get({
    projectId: project.id,
    versionId: version.id,
    mode: isXML ? "xml" : "ai-sdk",
  });

  const tools = {
    list_dir: listDirTool,
    read_file: readFileTool,
    search_codebase: searchCodebaseTool,
    query_related_declarations: queryRelatedDeclarationsTool,
    fzf: fzfTool,
    grep: grepTool,
    find: findTool,
    call_coder: callCoderTool,
  } as const;

  const xmlProvider = new XMLProvider(tools, context);

  const system = isXML
    ? await prompts.planner(project, tools)
    : await prompts.planner(project);

  // Local function to execute planner agent and handle tool calls
  const executePlannerAgent = async (): Promise<boolean> => {
    let shouldRecur = false;
    const promptMessages = await getMessages(version.chatId);

    logger.info("promptMessages", {
      extra: { promptMessages },
    });

    const result = xmlProvider.streamText({
      model: registry.languageModel("google:gemini-2.5-pro"),
      system,
      messages: promptMessages,
      onError: (error) => {
        logger.error("Error in planner agent", {
          extra: { error },
        });
      },
    });

    const messagesToSave: z.infer<typeof addMessageItemSchema>[] = [];
    const toolResultMessages: z.infer<typeof addMessageItemSchema>[] = [];
    const assistantContent: z.infer<typeof assistantMessageContentSchema>[] =
      [];

    for await (const part of result.fullStream) {
      switch (part.type) {
        case "text-delta": {
          const lastItem = assistantContent[assistantContent.length - 1];
          if (lastItem && lastItem.type === "text") {
            lastItem.text += part.text;
          } else {
            assistantContent.push({
              type: "text",
              text: part.text,
            });
          }
          break;
        }
        case "reasoning-delta": {
          const lastItem = assistantContent[assistantContent.length - 1];
          if (lastItem && lastItem.type === "reasoning") {
            lastItem.text += part.text;
          } else {
            assistantContent.push({
              type: "reasoning",
              text: part.text,
            });
          }
          break;
        }
        case "tool-call": {
          assistantContent.push({
            type: "tool-call",
            toolCallId: part.toolCallId,
            toolName: part.toolName,
            input: part.input,
          });
          break;
        }
        case "tool-result": {
          toolResultMessages.push({
            visibility: "internal",
            role: "tool",
            content: [
              {
                type: "tool-result",
                toolCallId: part.toolCallId,
                toolName: part.toolName,
                input: part.input,
                output: part.output,
              },
            ],
          });

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
          break;
        }
        case "tool-error": {
          toolResultMessages.push({
            visibility: "internal",
            role: "tool",
            content: [
              {
                type: "tool-result",
                toolCallId: part.toolCallId,
                toolName: part.toolName,
                input: part.input,
                output: part.error,
                isError: true,
              },
            ],
          });
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

    if (assistantContent.length > 0) {
      messagesToSave.push({
        visibility: "public",
        role: "assistant",
        content: assistantContent,
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
      });
    }

    messagesToSave.push(...toolResultMessages);

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
}
