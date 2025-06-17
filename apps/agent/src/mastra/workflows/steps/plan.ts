import { insertMessages } from "@/lib/insert-messages";
import { convertMessagesToCoreMessages } from "@/lib/utils";
import type { AgentRuntimeContext } from "@/mastra";
import { plannerAgent } from "@/mastra/agents/planner";
import { createStep } from "@mastra/core";
import type { RuntimeContext } from "@mastra/core/runtime-context";
import { db, eq } from "@weldr/db";
import { chats, versions } from "@weldr/db/schema";
import { z } from "zod";

export const planStep = createStep({
  id: "plan-step",
  description: "Plan the next step",
  inputSchema: z.void(),
  outputSchema: z.object({
    messages: z.array(z.any()),
  }),
  execute: async ({
    runtimeContext,
    suspend,
  }: {
    runtimeContext: RuntimeContext<AgentRuntimeContext>;
    // biome-ignore lint/complexity/noBannedTypes: <explanation>
    suspend: (input: {}) => Promise<void>;
  }) => {
    const project = runtimeContext.get("project");
    const version = runtimeContext.get("version");
    const user = runtimeContext.get("user");

    // Get the SSE stream writer from global connections
    const streamId = version.chatId;
    const streamWriter = global.sseConnections?.get(streamId) || {
      write: async () => {},
      close: async () => {},
    };

    const chat = await db.query.chats.findFirst({
      where: eq(chats.id, version.chatId),
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
      console.log(`[api/generate:${project.id}] Chat not found`);
      throw new Error("Chat not found");
    }

    const promptMessages = convertMessagesToCoreMessages(chat.messages);

    if (!version) {
      throw new Error("Version not found");
    }

    async function generate() {
      return await plannerAgent.stream(promptMessages, {
        runtimeContext,
        maxSteps: 3,
        onStepFinish: async ({ text, finishReason, toolResults }) => {
          console.log(
            `[api/generate:onStepFinish:${project.id}] Tool results: ${JSON.stringify(toolResults, null, 2)}`,
          );

          if (finishReason === "tool-calls" && text) {
            promptMessages.push({
              role: "assistant",
              content: text,
            });
            await insertMessages({
              input: {
                chatId: version.chatId,
                userId: user.id,
                messages: [
                  {
                    role: "assistant",
                    rawContent: [{ type: "paragraph", value: text }],
                  },
                ],
              },
            });
          }

          for (const toolResult of toolResults) {
            switch (toolResult.toolName) {
              case "initProject": {
                promptMessages.push({
                  role: "tool",
                  content: [
                    {
                      type: "tool-result",
                      toolCallId: toolResult.toolCallId,
                      toolName: toolResult.toolName,
                      result: `Initialized the project as a ${toolResult.args.config.server && toolResult.args.config.client ? "full-stack" : toolResult.args.config.server ? "server" : "client"} app`,
                    },
                  ],
                });
                await generate();
                break;
              }
              case "upgradeToFullStack": {
                promptMessages.push({
                  role: "tool",
                  content: [
                    {
                      type: "tool-result",
                      toolCallId: toolResult.toolCallId,
                      toolName: toolResult.toolName,
                      result: "Upgraded the project to full-stack app",
                    },
                  ],
                });
                await generate();
                break;
              }
              case "startCoding": {
                const { commitMessage, description } = toolResult.args;
                await db
                  .update(versions)
                  .set({
                    progress: "initiated",
                    message: commitMessage,
                    description,
                  })
                  .where(eq(versions.id, version.id));
                break;
              }
            }
          }
        },
        onFinish: async ({ text, finishReason }) => {
          if (finishReason === "stop" && text) {
            console.log(`[api/generate:onFinish:${project.id}] ${text}`);
            await insertMessages({
              input: {
                chatId: version.chatId,
                userId: user.id,
                messages: [
                  {
                    role: "assistant",
                    rawContent: [{ type: "paragraph", value: text }],
                  },
                ],
              },
            });
          }
        },
        onError: (error) => {
          console.error(
            `[api/generate:onError:${project.id}] ${JSON.stringify(error, null, 2)}`,
          );
        },
      });
    }

    const result = await generate();

    (async () => {
      try {
        for await (const chunk of result.textStream) {
          await streamWriter.write({
            type: "paragraph",
            text: chunk,
          });
        }

        const usageData = await result.usage;
        console.log(
          `[api/generate:usage:${project.id}] ${JSON.stringify(usageData, null, 2)}`,
        );
      } catch (error) {
        console.error(
          `[api/generate:error:${project.id}] ${JSON.stringify(error, null, 2)}`,
        );
        throw error;
      } finally {
        await streamWriter.write({ type: "end" });
      }
    })();

    const updatedVersion = await db.query.versions.findFirst({
      where: eq(versions.id, version.id),
    });

    if (!updatedVersion) {
      throw new Error("Version not found");
    }

    return {
      messages: promptMessages,
      commitMessage: updatedVersion.message,
      description: updatedVersion.description,
    };
  },
});
