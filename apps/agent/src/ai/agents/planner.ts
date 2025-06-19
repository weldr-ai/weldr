import { prompts } from "@/ai/prompts";
import { startCoderTool } from "@/ai/tools/coder";
import { setupIntegrationsTool } from "@/ai/tools/integrations";
import { initProjectTool, upgradeToFullStackTool } from "@/ai/tools/projects";
import { insertMessages } from "@/ai/utils/insert-messages";
import { registry } from "@/lib/registry";
import type { WorkflowContext } from "@/workflow/context";
import { db, eq } from "@weldr/db";
import { versions } from "@weldr/db/schema";
import type { ChatMessage } from "@weldr/shared/types";
import { streamText } from "ai";
import { getMessages } from "../utils/get-messages";

export async function plannerAgent({
  context,
  coolDownPeriod = 5000,
}: {
  context: WorkflowContext;
  coolDownPeriod?: number;
}) {
  const project = context.get("project");
  const user = context.get("user");
  let version = context.get("version");

  // Get the SSE stream writer from global connections
  const streamWriter = global.sseConnections?.get(version.chatId);

  if (!streamWriter) {
    throw new Error("Stream writer not found");
  }

  // Local function to execute planner agent and handle tool calls
  const executePlannerAgent = async () => {
    const newMessages: ChatMessage[] = [];
    let recur = false;

    const promptMessages = await getMessages(version.chatId);

    const result = await streamText({
      model: registry.languageModel("google:gemini-2.5-pro"),
      system: await prompts.planner(project),
      messages: promptMessages,
      tools: {
        initProject: initProjectTool(context),
        upgradeToFullStack: upgradeToFullStackTool(context),
        setupIntegrationsTool: setupIntegrationsTool(context),
        startCoding: startCoderTool(context),
      },
      onStepFinish: async ({
        text,
        reasoning,
        reasoningDetails,
        finishReason,
        toolResults,
      }) => {
        if (finishReason === "stop" && text && text.length > 0) {
          console.log(
            `[plannerAgent:onStepFinish:${project.id}] ${finishReason} ${text}`,
          );
          await insertMessages({
            input: {
              chatId: version.chatId,
              userId: user.id,
              messages: [
                {
                  type: "internal",
                  role: "assistant",
                  rawContent: [{ type: "paragraph", value: text }],
                },
              ],
            },
          });
        }

        if (finishReason === "tool-calls") {
          if (text && text.trim().length > 0) {
            console.log(
              `[plannerAgent:onStepFinish:${project.id}] ${finishReason} ${text}`,
            );
            newMessages.push({
              type: "public",
              role: "assistant",
              rawContent: [{ type: "paragraph", value: text }],
              createdAt: new Date(),
            });
          }

          for (const toolResult of toolResults) {
            switch (toolResult.toolName) {
              case "initProject": {
                console.log(
                  `[plannerAgent:initProject:${project.id}] Tool result: ${JSON.stringify(toolResult, null, 2)}`,
                );
                newMessages.push({
                  type: "internal",
                  role: "tool",
                  rawContent: {
                    toolCallId: toolResult.toolCallId,
                    toolName: toolResult.toolName,
                    toolArgs: toolResult.args,
                    toolResult: `Initialized the project as a ${toolResult.args.config.server && toolResult.args.config.client ? "full-stack" : toolResult.args.config.server ? "server" : "client"} app`,
                  },
                  createdAt: new Date(),
                });
                recur = true;
                break;
              }
              case "upgradeToFullStack": {
                console.log(
                  `[plannerAgent:upgradeToFullStack:${project.id}] Tool result: ${JSON.stringify(toolResult, null, 2)}`,
                );
                newMessages.push({
                  type: "internal",
                  role: "tool",
                  rawContent: {
                    toolCallId: toolResult.toolCallId,
                    toolName: toolResult.toolName,
                    toolArgs: toolResult.args,
                    toolResult: "Upgraded the project to full-stack app",
                  },
                  createdAt: new Date(),
                });
                recur = true;
                break;
              }
              case "setupIntegrationsTool": {
                console.log(
                  `[plannerAgent:setupIntegrationsTool:${project.id}] Tool result: ${JSON.stringify(toolResult, null, 2)}`,
                );
                newMessages.push({
                  type: "public",
                  role: "tool",
                  rawContent: {
                    toolName: "setupIntegrationsTool",
                    toolCallId: toolResult.toolCallId,
                    toolArgs: toolResult.args,
                    toolResult: {
                      status: "pending",
                    },
                  },
                  createdAt: new Date(),
                });
                await streamWriter.write({
                  type: "tool",
                  toolName: "setupIntegrationsTool",
                  toolArgs: toolResult.args,
                  toolResult: {
                    status: "pending",
                  },
                });
                break;
              }
              case "startCoding": {
                console.log(
                  `[plannerAgent:startCoding:${project.id}] Tool result: ${JSON.stringify(toolResult, null, 2)}`,
                );
                const { commitMessage, description } = toolResult.args;

                const [updatedVersion] = await db
                  .update(versions)
                  .set({
                    progress: "initiated",
                    message: commitMessage,
                    description,
                  })
                  .where(eq(versions.id, version.id))
                  .returning();

                if (!updatedVersion) {
                  throw new Error(
                    `[plannerAgent:startCodingTool:${project.id}] Failed to update version: Version not found`,
                  );
                }

                newMessages.push({
                  type: "internal",
                  role: "user",
                  rawContent: [
                    {
                      type: "paragraph",
                      value: `You are working on the following version:\nCommit message: ${commitMessage}\nDescription: ${description}`,
                    },
                  ],
                  createdAt: new Date(),
                });

                version = updatedVersion;
                context.set("version", updatedVersion);

                break;
              }
              default: {
                console.log(`[plannerAgent:${project.id}] Unknown tool call`);
                break;
              }
            }
          }

          if (newMessages.length > 0) {
            await insertMessages({
              input: {
                chatId: version.chatId,
                userId: user.id,
                messages: newMessages,
              },
            });
          }
        }

        console.log(
          `[plannerAgent:onFinish:${project.id}] ${JSON.stringify({ text, reasoning, reasoningDetails, finishReason, toolResults }, null, 2)}`,
        );
      },
      onError: (error) => {
        console.error(
          `[plannerAgent:onError:${project.id}] ${JSON.stringify(error, null, 2)}`,
        );
      },
    });

    // If we need to continue, call the agent again with fresh messages
    if (recur) {
      await new Promise((resolve) => setTimeout(resolve, coolDownPeriod));
      return executePlannerAgent();
    }

    return result;
  };

  const result = await executePlannerAgent();

  // Stream the response
  try {
    for await (const chunk of result.textStream) {
      await streamWriter.write({
        type: "paragraph",
        text: chunk,
      });
    }
    const usageData = await result.usage;
    console.log(
      `[plannerAgent:usage:${project.id}] ${JSON.stringify(usageData, null, 2)}`,
    );
  } catch (error) {
    console.error(
      `[plannerAgent:error:${project.id}] ${JSON.stringify(error, null, 2)}`,
    );
    throw error;
  }

  if (!version) {
    throw new Error("Version not found");
  }

  // End the stream
  await streamWriter.write({ type: "end" });
}
