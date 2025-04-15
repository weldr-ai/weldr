"use server";

import { insertMessages } from "@/lib/ai/insert-messages";
import { prompts } from "@/lib/ai/prompts";
import { registry } from "@/lib/ai/registry";
import { setupIntegration, setupIntegrationTool } from "@/lib/ai/tools";
import { implement, implementTool } from "@/lib/ai/tools/implement";
import {
  initializeProject,
  initializeProjectTool,
} from "@/lib/ai/tools/initialize-project";
import { convertMessagesToCoreMessages } from "@/lib/ai/utils";
import type { TStreamableValue } from "@/types";
import { auth } from "@weldr/auth";
import { and, db, eq } from "@weldr/db";
import { chats, projects } from "@weldr/db/schema";
import { streamText } from "ai";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export async function POST(request: Request) {
  const { chatId, projectId } = await request.json();

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

  const promptMessages = convertMessagesToCoreMessages(chat.messages);

  const stream = new TransformStream<TStreamableValue>({
    async transform(chunk, controller) {
      controller.enqueue(`${JSON.stringify(chunk)}|CHUNK|`);
    },
  });

  const streamWriter = stream.writable.getWriter();

  (async () => {
    try {
      const result = streamText({
        model: registry.languageModel("openai:gpt-4o"),
        system: prompts.requirementsGatherer,
        messages: promptMessages,
        experimental_activeTools: project.initiatedAt
          ? ["implementTool", "setupIntegrationTool"]
          : ["initializeProjectTool", "setupIntegrationTool"],
        tools: {
          implementTool,
          initializeProjectTool,
          setupIntegrationTool,
        },
        maxSteps: 3,
        onFinish: async ({ text, finishReason, toolCalls, toolResults }) => {
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
                      createdAt: new Date(),
                    },
                  ],
                },
              });
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
                      createdAt: new Date(),
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
                        streamWriter,
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
                        streamWriter,
                        tx,
                        chatId,
                        userId: session.user.id,
                        projectId,
                        toolArgs,
                        promptMessages,
                      });

                      break;
                    }
                    case "setupIntegrationTool": {
                      const toolResult = toolResults.find(
                        (toolResult) =>
                          toolResult.toolName === "setupIntegrationTool",
                      );

                      if (!toolResult) {
                        throw new Error("Tool result not found");
                      }

                      await setupIntegration({
                        streamWriter,
                        tx,
                        chatId,
                        userId: session.user.id,
                        toolArgs: toolResult.args,
                      });

                      break;
                    }
                  }
                })();
              }
            }
          });
        },
        onError: (error) => {
          console.error(`[api/generate:onError:${projectId}] ${error}`);
        },
      });

      for await (const chunk of result.textStream) {
        console.log(
          `[api/generate:onChunk:${projectId}] ${JSON.stringify(chunk)}`,
        );
        await streamWriter.write({
          type: "paragraph",
          text: chunk,
        });
      }

      const usageData = await result.usage;

      // Log usage
      console.log(
        `[api/generate:${projectId}] Usage Prompt: ${usageData.promptTokens} Completion: ${usageData.completionTokens} Total: ${usageData.totalTokens}`,
      );
    } finally {
      await streamWriter.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "application/json",
      "Transfer-Encoding": "chunked",
    },
  });
}
