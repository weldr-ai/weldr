import { streamText } from "ai";
import type { z } from "zod";
import { prompts } from "@/ai/prompts";
import {
  addIntegrationsTool,
  callCoderTool,
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

import { db, eq } from "@weldr/db";
import { versions } from "@weldr/db/schema";
import { Logger } from "@weldr/shared/logger";
import type {
  addMessageItemSchema,
  assistantMessageContentSchema,
} from "@weldr/shared/validators/chats";
import { queryRelatedDeclarationsTool } from "../tools/query-related-declarations";
import { XMLProvider } from "../utils/xml-provider";

export async function plannerAgent({
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
      callCoderTool.getXML(),
      initProjectTool.getXML(),
      listDirTool.getXML(),
      readFileTool.getXML(),
      searchCodebaseTool.getXML(),
      queryRelatedDeclarationsTool.getXML(),
      fzfTool.getXML(),
      grepTool.getXML(),
      findTool.getXML(),
    ],
    context,
  );

  const system = isXML
    ? await prompts.planner(project, xmlProvider.getSpecsMarkdown())
    : await prompts.planner(project);

  // Local function to execute planner agent and handle tool calls
  const executePlannerAgent = async (): Promise<boolean> => {
    let shouldRecur = false;
    let hasToolErrors = false;
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
            logger.error("Error in planner agent", {
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
            call_coder: callCoderTool(context),
            search_codebase: searchCodebaseTool(context),
            query_related_declarations: queryRelatedDeclarationsTool(context),
            fzf: fzfTool(context),
            grep: grepTool(context),
            find: findTool(context),
          },
          onError: (error) => {
            logger.error("Error in planner agent", {
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
        if (
          delta.toolName === "add_integrations" ||
          delta.toolName === "init_project" ||
          delta.toolName === "list_dir" ||
          delta.toolName === "read_file" ||
          delta.toolName === "search_codebase" ||
          delta.toolName === "query_related_declarations" ||
          delta.toolName === "fzf" ||
          delta.toolName === "grep" ||
          delta.toolName === "find"
        ) {
          await db
            .update(versions)
            .set({ status: "planning" })
            .where(eq(versions.id, version.id));
          await streamWriter.write({
            type: "update_project",
            data: { currentVersion: { status: "planning" } },
          });
          shouldRecur = true;
        }
      } else if (delta.type === "tool-result") {
        if (
          delta.result &&
          typeof delta.result === "object" &&
          "error" in delta.result &&
          Boolean(delta.result.error)
        ) {
          hasToolErrors = true;
          logger.warn(
            "Tool execution error detected, breaking stream processing",
            {
              toolName: delta.toolName,
              toolCallId: delta.toolCallId,
              error: delta.result,
            },
          );
        }

        if (
          delta.toolName === "add_integrations" &&
          delta.result?.status === "requires_configuration"
        ) {
          await streamWriter.write({
            type: "tool",
            toolName: delta.toolName,
            toolCallId: delta.toolCallId,
            toolArgs: delta.args,
            toolResult: delta.result,
          });
        }

        toolResultMessages.push({
          visibility:
            delta.toolName === "add_integrations" &&
            delta.result?.status === "requires_configuration"
              ? "public"
              : "internal",
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: delta.toolCallId,
              toolName: delta.toolName,
              result: delta.result,
            },
          ],
        });

        if (hasToolErrors) {
          break;
        }
      }
    }

    if (hasToolErrors) {
      shouldRecur = true;
      logger.info("Continuing loop due to tool errors");
    }

    // const usage = await result.usage;

    // const cost = await calculateModelCost(
    //   "google:gemini-2.5-pro",
    //   usage.promptTokens,
    //   usage.completionTokens,
    // );

    const finishReason = await result.finishReason;

    if (assistantContent.length > 0) {
      messagesToSave.push({
        visibility: "public",
        role: "assistant",
        content: assistantContent,
        metadata: {
          provider: "google",
          model: "gemini-2.5-pro",
          // inputTokens: usage.promptTokens,
          // outputTokens: usage.completionTokens,
          // totalTokens: usage.totalTokens,
          // inputCost: cost?.inputCost ?? 0,
          // outputCost: cost?.outputCost ?? 0,
          // totalCost: cost?.totalCost ?? 0,
          // inputTokensPrice: cost?.inputTokensPrice ?? 0,
          // outputTokensPrice: cost?.outputTokensPrice ?? 0,
          // inputImagesPrice: cost?.inputImagesPrice ?? null,
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

  if (version.status === "pending") {
    logger.info("Version status is still pending, stopping planner agent");
    await streamWriter.write({ type: "end" });
    return "suspend";
  }

  logger.info("Planner agent completed");
}
