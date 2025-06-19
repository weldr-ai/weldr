import { prompts } from "@/ai/prompts";
import { startCoderTool } from "@/ai/tools/coder";
import { setupIntegrationsTool } from "@/ai/tools/integrations";
import { initProjectTool, upgradeToFullStackTool } from "@/ai/tools/projects";
import { registry } from "@/lib/registry";
import type { WorkflowContext } from "@/workflow/context";
import { db, eq } from "@weldr/db";
import { versions } from "@weldr/db/schema";
import { streamText } from "ai";
import { getMessages } from "../utils/get-messages";
import { saveResponseMessages } from "../utils/save-response-messages";

export async function plannerAgent({
  context,
  coolDownPeriod = 5000,
}: {
  context: WorkflowContext;
  coolDownPeriod?: number;
}) {
  const project = context.get("project");
  const user = context.get("user");
  const version = context.get("version");

  // Get the SSE stream writer from global connections
  const streamWriter = global.sseConnections?.get(version.chatId);

  if (!streamWriter) {
    throw new Error("Stream writer not found");
  }

  // Local function to execute planner agent and handle tool calls
  const executePlannerAgent = async () => {
    let shouldRecur = false;

    const promptMessages = await getMessages(version.chatId);

    const result = await streamText({
      model: registry.languageModel("google:gemini-2.5-pro"),
      system: await prompts.planner(project),
      messages: promptMessages,
      tools: {
        initProject: initProjectTool(context),
        upgradeToFullStack: upgradeToFullStackTool(context),
        setupIntegrations: setupIntegrationsTool(context),
        startCoding: startCoderTool(context),
      },
      onFinish: async ({ response, toolResults, finishReason }) => {
        const messages = response.messages;
        await saveResponseMessages({
          type: "public",
          chatId: version.chatId,
          userId: user.id,
          messages,
        });
        switch (finishReason) {
          case "tool-calls": {
            for (const toolResult of toolResults) {
              switch (toolResult.toolName) {
                case "initProject":
                case "upgradeToFullStack": {
                  shouldRecur = true;
                  break;
                }
                case "startCoding": {
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
                  context.set("version", updatedVersion);
                  break;
                }
              }
            }
            break;
          }
        }
      },
      onError: (error) => {
        console.error(
          `[plannerAgent:onError:${project.id}] ${JSON.stringify(error, null, 2)}`,
        );
      },
    });

    // If we need to continue, call the agent again with fresh messages
    if (shouldRecur) {
      console.log(
        `[plannerAgent:${project.id}] Recurring in ${coolDownPeriod / 1000}s...`,
      );
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

  // End the stream
  await streamWriter.write({ type: "end" });
}
