import type { z } from "zod";
import { prompts } from "@/ai/prompts";
import {
  addIntegrationsTool,
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
import { getSSEConnection } from "@/lib/utils";
import type { WorkflowContext } from "@/workflow/context";

import { Logger } from "@weldr/shared/logger";
import { nanoid } from "@weldr/shared/nanoid";
import type {
  addMessageItemSchema,
  assistantMessageContentSchema,
} from "@weldr/shared/validators/chats";
import { callPlannerTool } from "../tools/call-planner";
import { queryRelatedDeclarationsTool } from "../tools/query-related-declarations";
import { XMLProvider } from "../tools/xml/provider";
import { calculateModelCost } from "../utils/providers-pricing";

export async function requirementsAgent({
  context,
  coolDownPeriod = 1000,
}: {
  context: WorkflowContext;
  coolDownPeriod?: number;
}): Promise<"suspend" | undefined> {
  const project = context.get("project");
  const user = context.get("user");
  const version = context.get("version");
  const isXML = context.get("isXML");

  const streamWriter = getSSEConnection(version.chatId);

  const logger = Logger.get({
    projectId: project.id,
    versionId: version.id,
    mode: isXML ? "xml" : "ai-sdk",
  });

  const toolSet = {
    add_integrations: addIntegrationsTool,
    list_dir: listDirTool,
    read_file: readFileTool,
    search_codebase: searchCodebaseTool,
    query_related_declarations: queryRelatedDeclarationsTool,
    fzf: fzfTool,
    grep: grepTool,
    find: findTool,
    call_planner: callPlannerTool,
  } as const;

  const xmlProvider = new XMLProvider(toolSet, context);

  const system = isXML
    ? await prompts.requirements(project, toolSet)
    : await prompts.requirements(project);

  const executeRequirementsAgent = async (): Promise<boolean> => {
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
        logger.error("Error in requirements agent", {
          extra: { error },
        });
      },
    });

    // Prepare messages to store
    const messagesToSave: z.infer<typeof addMessageItemSchema>[] = [];
    const toolResultMessages: z.infer<typeof addMessageItemSchema>[] = [];
    const assistantContent: z.infer<typeof assistantMessageContentSchema>[] =
      [];

    for await (const part of result.fullStream) {
      switch (part.type) {
        case "text-delta": {
          // Stream text content to SSE
          await streamWriter.write({
            type: "text",
            text: part.text,
          });

          // Add text content immediately to maintain proper order
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
            visibility:
              part.toolName === "add_integrations" ? "public" : "internal",
            role: "tool",
            content: [
              {
                type: "tool-result",
                toolCallId: part.toolCallId,
                toolName: part.toolName,
                output: part.output,
              },
            ],
          });

          if (part.toolName === "add_integrations") {
            await streamWriter.write({
              type: "tool",
              message: {
                id: nanoid(),
                visibility: "public",
                createdAt: new Date(),
                chatId: version.chatId,
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
              },
            });
            if (part.output.status === "awaiting_config") {
              shouldRecur = false;
            } else {
              shouldRecur = true;
            }
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

  let shouldContinue = true;
  let iterationCount = 0;
  while (shouldContinue) {
    iterationCount++;
    logger.info(`Starting requirements agent iteration ${iterationCount}`);
    shouldContinue = await executeRequirementsAgent();
    if (shouldContinue) {
      logger.info(`Recurring in ${coolDownPeriod}ms...`);
      await new Promise((resolve) => setTimeout(resolve, coolDownPeriod));
    }
  }

  if (version.status === "pending") {
    logger.info("Version status is still pending, stopping requirements agent");
    await streamWriter.write({ type: "end" });
    return "suspend";
  }

  logger.info("Requirements agent completed");
}
