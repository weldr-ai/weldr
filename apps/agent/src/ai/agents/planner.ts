import { prompts } from "@/ai/prompts";
import {
  callCoderTool,
  initProjectTool,
  requestIntegrationConfigurationTool,
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
} from "@weldr/shared/validators/chats";
import { streamText } from "ai";
import type { z } from "zod";
import { XMLProvider } from "../utils/xml-provider";

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
  const isXML = context.get("isXML");

  const streamWriter = global.sseConnections?.get(version.chatId);
  if (!streamWriter) {
    throw new Error("Stream writer not found");
  }

  // Create contextual logger with base tags and extras
  const logger = Logger.get({
    tags: ["plannerAgent"],
    extra: {
      projectId: project.id,
      versionId: version.id,
      mode: isXML ? "xml" : "ai-sdk",
    },
  });

  const xmlProvider = new XMLProvider(
    [
      initProjectTool.getXML(),
      upgradeProjectTool.getXML(),
      requestIntegrationConfigurationTool.getXML(),
      callCoderTool.getXML(),
    ],
    context,
  );

  const system = isXML
    ? await prompts.planner(project, xmlProvider.getSpecsMarkdown())
    : await prompts.planner(project);

  // Local function to execute planner agent and handle tool calls
  const executePlannerAgent = async (): Promise<boolean> => {
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
            init_project: initProjectTool(context),
            upgrade_project: upgradeProjectTool(context),
            request_integration_configuration:
              requestIntegrationConfigurationTool(context),
            call_coder: callCoderTool(context),
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
        // Check if initProject or upgradeProject tools were called
        if (
          delta.toolName === "init_project" ||
          delta.toolName === "upgrade_project"
        ) {
          shouldRecur = true;
        }
      } else if (delta.type === "tool-result") {
        if (delta.toolName === "request_integration_configuration") {
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
            delta.toolName === "request_integration_configuration"
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
      }
    }

    // Add assistant message
    if (assistantContent.length > 0) {
      messagesToSave.push({
        visibility: "public",
        role: "assistant",
        content: assistantContent,
      });
    }

    messagesToSave.push(...toolResultMessages);

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
}
