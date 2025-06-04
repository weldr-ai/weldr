"use server";

import { insertMessages } from "@/lib/ai/insert-messages";
import { prompts } from "@/lib/ai/prompts";
import { registry } from "@/lib/ai/registry";
import {
  executeSetupIntegrationTool,
  setupIntegrationTool,
} from "@/lib/ai/tools";
import { coderTool, executeCoderTool } from "@/lib/ai/tools/coder";
import { convertMessagesToCoreMessages } from "@/lib/ai/utils";
import type { TStreamableValue } from "@/types";
import { auth } from "@weldr/auth";
import { and, db, eq, isNotNull } from "@weldr/db";
import { chats, integrations, projects, versions } from "@weldr/db/schema";
import { Fly } from "@weldr/shared/fly";
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

  const devNodeId = await Fly.machine.getDevNodeId({
    projectId,
  });

  const integrationsList = await db.query.integrations.findMany({
    where: eq(integrations.projectId, projectId),
    with: {
      integrationTemplate: true,
    },
  });

  const allIntegrationTemplates =
    await db.query.integrationTemplates.findMany();

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

  const activeVersion = await db.query.versions.findFirst({
    where: and(
      eq(versions.projectId, projectId),
      isNotNull(versions.activatedAt),
    ),
  });

  (async () => {
    try {
      if (activeVersion && activeVersion.progress !== "succeeded") {
        await executeCoderTool({
          chatId,
          userId: session.user.id,
          projectId,
          machineId: devNodeId,
          promptMessages,
          streamWriter,
          toolArgs: {
            name: project.name,
            requirements: activeVersion.description as string,
            commitMessage: activeVersion.message as string,
          },
        });
      } else {
        const result = streamText({
          model: registry.languageModel("openai:gpt-4.1"),
          system: prompts.requirementsGatherer(
            activeVersion
              ? `You are working on a project called ${project.name} that was initiated at ${activeVersion.createdAt.toISOString()}

This project has the following integrations setup:
${integrationsList
  .map((integration) => `- ${integration.integrationTemplate.name}`)
  .join(", ")}`
              : "This is a new project",
            allIntegrationTemplates
              .map(
                (integrationTemplate) =>
                  `- ${integrationTemplate.name} (key: ${integrationTemplate.key}):
Type: ${integrationTemplate.type}
Description: ${integrationTemplate.description}`,
              )
              .join("\n\n"),
          ),
          messages: promptMessages,
          tools: {
            coderTool,
            setupIntegrationTool,
          },
          maxSteps: 3,
          onFinish: async ({ text, finishReason, toolCalls }) => {
            if (finishReason === "stop" && text) {
              console.log(`[api/generate:onFinish:${projectId}] ${text}`);
              await insertMessages({
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
              console.log(
                `[api/generate:onFinish:${projectId}] Tool calls: ${JSON.stringify(toolCalls)}`,
              );

              if (text) {
                await insertMessages({
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

              for (const toolCall of toolCalls) {
                switch (toolCall.toolName) {
                  case "coderTool": {
                    console.log(
                      `[api/generate:onFinish:${projectId}] Executing coder tool`,
                    );
                    await executeCoderTool({
                      chatId,
                      userId: session.user.id,
                      projectId,
                      machineId: devNodeId,
                      promptMessages,
                      streamWriter,
                      toolArgs: toolCall.args,
                    });
                    break;
                  }
                  case "setupIntegrationTool": {
                    console.log(
                      `[api/generate:onFinish:${projectId}] Executing setup integration tool`,
                    );
                    await executeSetupIntegrationTool({
                      chatId,
                      userId: session.user.id,
                      toolArgs: toolCall.args,
                      streamWriter,
                    });
                    break;
                  }
                }
              }
            }
          },
          onError: (error) => {
            console.error(
              `[api/generate:onError:${projectId}] ${JSON.stringify(error, null, 2)}`,
            );
          },
        });

        for await (const chunk of result.textStream) {
          await streamWriter.write({
            type: "paragraph",
            text: chunk,
          });
        }

        const usageData = await result.usage;

        console.log(
          `[api/generate:${projectId}] Prompt Tokens: ${usageData.promptTokens} + Completion Tokens: ${usageData.completionTokens} = Total Tokens: ${usageData.totalTokens}`,
        );
      }
    } finally {
      console.log("Closing stream writer");
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
