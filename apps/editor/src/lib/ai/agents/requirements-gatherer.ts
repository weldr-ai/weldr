"use server";

import type { TStreamableValue } from "@/types";
import { auth } from "@weldr/auth";
import { and, db, eq } from "@weldr/db";
import { chats, projects } from "@weldr/db/schema";
import type {
  CodeMessageRawContent,
  ToolMessageRawContent,
  VersionMessageRawContent,
} from "@weldr/shared/types";
import { type CoreMessage, streamText } from "ai";
import { createStreamableValue } from "ai/rsc";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { insertMessages } from "../insert-messages";
import { prompts } from "../prompts";
import { registry } from "../registry";
import {
  implement,
  implementTool,
  initializeProject,
  initializeProjectTool,
  setupResourceTool,
} from "../tools";
import { setupResource } from "../tools/setup-resource";

export async function requirementsGatherer({
  chatId,
  projectId,
}: {
  chatId: string;
  projectId: string;
}) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/auth/sign-in");
  }

  const project = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, projectId),
      eq(projects.userId, session.user.id),
    ),
  });

  if (!project) {
    throw new Error("Project not found");
  }

  const chat = await db.query.chats.findFirst({
    where: eq(chats.id, chatId),
    with: {
      messages: {
        orderBy: (chatMessages, { asc }) => [asc(chatMessages.createdAt)],
        columns: {
          role: true,
          content: true,
          rawContent: true,
        },
        limit: 10,
      },
    },
  });

  if (!chat) {
    throw new Error("Chat not found");
  }

  const promptMessages: CoreMessage[] = [];

  for (const message of chat.messages) {
    if (message.role === "tool") {
      const toolInfo = message.rawContent as ToolMessageRawContent;

      if (
        toolInfo.toolName === "setupResource" &&
        toolInfo.toolResult?.status !== "pending"
      ) {
        promptMessages.push({
          role: "user",
          content: `Setting up ${toolInfo.toolArgs?.resource} has been ${toolInfo.toolResult?.status}.`,
        });
      } else if (toolInfo.toolName === "initializeProject") {
        promptMessages.push({
          role: "assistant",
          content: `Initialized project ${toolInfo.toolArgs?.name} with ${toolInfo.toolArgs?.requirements}`,
        });
      } else if (toolInfo.toolName === "implement") {
        promptMessages.push({
          role: "assistant",
          content: `Implemented ${toolInfo.toolArgs?.requirements}`,
        });
      }

      continue;
    }

    if (message.role === "version") {
      const version = message.rawContent as VersionMessageRawContent;
      promptMessages.push({
        role: "assistant",
        content: `Created #${version.versionNumber} ${version.versionMessage}`,
      });
      continue;
    }

    if (message.content === null) continue;

    if (message.role === "code") {
      const code = message.rawContent as CodeMessageRawContent;

      for (const file of Object.keys(code)) {
        promptMessages.push({
          role: "assistant",
          content: `File: ${file}\n${code[file]?.newContent}`,
        });
      }
      continue;
    }

    promptMessages.push({
      role: message.role,
      content: message.content,
    });
  }

  const stream = createStreamableValue<TStreamableValue>();

  (async () => {
    const { textStream, usage } = streamText({
      model: registry.languageModel("openai:gpt-4o"),
      system: prompts.requirementsGatherer,
      messages: promptMessages,
      experimental_activeTools: project.initiatedAt
        ? ["implementTool", "setupResourceTool"]
        : ["initializeProjectTool", "setupResourceTool"],
      tools: {
        implementTool,
        initializeProjectTool,
        setupResourceTool,
      },
      maxSteps: 3,
      onFinish: async ({ text, finishReason, toolCalls, toolResults }) => {
        try {
          await db.transaction(async (tx) => {
            if (finishReason === "stop" && text) {
              await insertMessages({
                tx,
                input: {
                  chatId,
                  userId: session.user.id,
                  messages: [
                    {
                      role: "assistant",
                      rawContent: [{ type: "paragraph", value: text }],
                    },
                  ],
                },
              });
            }

            if (finishReason === "tool-calls") {
              for (const toolCall of toolCalls) {
                // Process each tool call sequentially
                await (async () => {
                  switch (toolCall.toolName) {
                    case "initializeProjectTool": {
                      const toolArgs = toolCalls.find(
                        (toolCall) =>
                          toolCall.toolName === "initializeProjectTool",
                      )?.args;

                      if (!toolArgs) {
                        throw new Error("Tool args not found");
                      }

                      await initializeProject({
                        stream,
                        tx,
                        chatId,
                        userId: session.user.id,
                        projectId,
                        toolArgs,
                        promptMessages,
                      });

                      break;
                    }
                    case "implementTool": {
                      const toolArgs = toolCalls.find(
                        (toolCall) => toolCall.toolName === "implementTool",
                      )?.args;

                      if (!toolArgs) {
                        throw new Error("Tool args not found");
                      }

                      await implement({
                        stream,
                        tx,
                        chatId,
                        userId: session.user.id,
                        projectId,
                        toolArgs,
                        promptMessages,
                      });

                      break;
                    }
                    case "setupResourceTool": {
                      const toolResult = toolResults.find(
                        (toolResult) =>
                          toolResult.toolName === "setupResourceTool",
                      );

                      if (!toolResult) {
                        throw new Error("Tool result not found");
                      }

                      await setupResource({
                        stream,
                        tx,
                        chatId,
                        userId: session.user.id,
                        toolArgs: toolResult.args,
                      });

                      break;
                    }
                  }

                  if (text) {
                    await insertMessages({
                      tx,
                      input: {
                        chatId,
                        userId: session.user.id,
                        messages: [
                          {
                            role: "assistant",
                            rawContent: [{ type: "paragraph", value: text }],
                          },
                        ],
                      },
                    });
                  }
                })();
              }
            }
          });
        } catch (error) {
          console.error("Error in onFinish handler:", error);
          throw error;
        }
      },
    });

    for await (const text of textStream) {
      stream.update({
        type: "text",
        text,
      });
    }

    const usageData = await usage;

    // Log usage
    console.log(
      `[requirementsGatherer:${projectId}] Usage Prompt: ${usageData.promptTokens} Completion: ${usageData.completionTokens} Total: ${usageData.totalTokens}`,
    );

    stream.done();
  })();

  return stream.value;
}
