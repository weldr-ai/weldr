import { streamText } from "ai";
import type { z } from "zod";
import { prompts } from "@/ai/prompts";
import {
  addIntegrationsTool,
  findTool,
  fzfTool,
  grepTool,
  initProjectTool,
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
import { callPlannerTool } from "../tools/call-planner";
import { queryRelatedDeclarationsTool } from "../tools/query-related-declarations";
import { calculateModelCost } from "../utils/providers-pricing";
import { XMLProvider } from "../utils/xml-provider";

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

  const streamWriter = global.sseConnections?.get(version.chatId);
  if (!streamWriter) {
    throw new Error("Stream writer not found");
  }

  const logger = Logger.get({
    projectId: project.id,
    versionId: version.id,
    mode: isXML ? "xml" : "ai-sdk",
  });

  const xmlProvider = new XMLProvider(
    [
      addIntegrationsTool.getXML(),
      initProjectTool.getXML(),
      listDirTool.getXML(),
      readFileTool.getXML(),
      searchCodebaseTool.getXML(),
      queryRelatedDeclarationsTool.getXML(),
      fzfTool.getXML(),
      grepTool.getXML(),
      findTool.getXML(),
      callPlannerTool.getXML(),
    ],
    context,
  );

  const system = isXML
    ? await prompts.requirementsAgent(project, xmlProvider.getSpecsMarkdown())
    : await prompts.requirementsAgent(project);

  const executeRequirementsAgent = async (): Promise<boolean> => {
    let shouldRecur = false;
    const promptMessages = await getMessages(version.chatId);

    logger.info("promptMessages", {
      extra: { promptMessages },
    });

    const result = isXML
      ? xmlProvider.streamText({
          model: registry.languageModel("google:gemini-2.5-pro"),
          system,
          messages: promptMessages,
          onError: (error) => {
            logger.error("Error in requirements agent", {
              extra: { error },
            });
          },
        })
      : streamText({
          model: registry.languageModel("google:gemini-2.5-pro"),
          system,
          messages: promptMessages,
          tools: {
            add_integrations: addIntegrationsTool(context),
            init_project: initProjectTool(context),
            list_dir: listDirTool(context),
            read_file: readFileTool(context),
            search_codebase: searchCodebaseTool(context),
            query_related_declarations: queryRelatedDeclarationsTool(context),
            fzf: fzfTool(context),
            grep: grepTool(context),
            find: findTool(context),
            call_planner: callPlannerTool(context),
          },
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

    for await (const delta of result.fullStream) {
      switch (delta.type) {
        case "text": {
          // Stream text content to SSE
          await streamWriter.write({
            type: "text",
            text: delta.text,
          });

          // Add text content immediately to maintain proper order
          const lastItem = assistantContent[assistantContent.length - 1];
          if (lastItem && lastItem.type === "text") {
            lastItem.text += delta.text;
          } else {
            assistantContent.push({
              type: "text",
              text: delta.text,
            });
          }
          break;
        }
        case "reasoning": {
          const lastItem = assistantContent[assistantContent.length - 1];
          if (lastItem && lastItem.type === "reasoning") {
            lastItem.text += delta.text;
          } else {
            assistantContent.push({
              type: "reasoning",
              text: delta.text,
            });
          }
          break;
        }
        case "tool-call": {
          assistantContent.push({
            type: "tool-call",
            toolCallId: delta.toolCallId,
            toolName: delta.toolName,
            input: delta.input,
          });
          break;
        }
        case "tool-result": {
          toolResultMessages.push({
            visibility:
              delta.toolName === "add_integrations" ||
              delta.toolName === "init_project"
                ? "public"
                : "internal",
            role: "tool",
            content: [
              {
                type: "tool-result",
                toolCallId: delta.toolCallId,
                toolName: delta.toolName,
                output: delta.output,
                isError: "isError" in delta && delta.isError,
              },
            ],
          });

          if ("isError" in delta && delta.isError) {
            shouldRecur = true;
            break;
          }

          if (
            delta.toolName === "add_integrations" ||
            delta.toolName === "init_project"
          ) {
            await streamWriter.write({
              type: "tool",
              toolName: delta.toolName,
              toolCallId: delta.toolCallId,
              input: delta.input,
              output: delta.output,
            });
            if (delta.output.status === "requires_configuration") {
              shouldRecur = false;
            } else {
              shouldRecur = true;
            }
          }

          if (
            delta.toolName === "list_dir" ||
            delta.toolName === "read_file" ||
            delta.toolName === "search_codebase" ||
            delta.toolName === "query_related_declarations" ||
            delta.toolName === "fzf" ||
            delta.toolName === "grep" ||
            delta.toolName === "find"
          ) {
            shouldRecur = true;
          }
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
