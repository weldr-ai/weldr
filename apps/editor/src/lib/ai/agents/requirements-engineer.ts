"use server";

import { models } from "@/lib/ai/models";
import { api } from "@/lib/trpc/server";
import { auth } from "@weldr/auth";
import { and, db, eq } from "@weldr/db";
import { chats, projects } from "@weldr/db/schema";
import type { ToolMessageRawContent } from "@weldr/shared/types";
import type { addMessageItemSchema } from "@weldr/shared/validators/chats";
import { type CoreMessage, streamText } from "ai";
import { createStreamableValue } from "ai/rsc";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { z } from "zod";
import { prompts } from "../prompts";
import { implement, initializeProject } from "../tools";

export async function requirementsEngineer(chatId: string, projectId: string) {
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
      }

      continue;
    }

    if (message.content === null) continue;

    promptMessages.push({
      role: message.role,
      content: message.content,
    });
  }

  const stream = createStreamableValue<
    | {
        type: "text";
        text: string;
      }
    | {
        type: "tool";
        toolName: string;
        toolArgs: Record<string, unknown>;
        toolResult: unknown;
      }
  >();

  (async () => {
    const { textStream } = streamText({
      model: models.geminiFlash,
      system: prompts.requirementsEngineer,
      messages: promptMessages,
      experimental_activeTools: project.initiatedAt
        ? ["implement"]
        : ["initializeProject"],
      tools: { implement, initializeProject },
      maxSteps: 3,
      onFinish: async ({ text, finishReason, toolCalls, toolResults }) => {
        const messages: z.infer<typeof addMessageItemSchema>[] = [];

        if (finishReason === "tool-calls") {
          for (const toolCall of toolCalls) {
            // const toolResult = toolResults.find(
            //   (toolResult) => toolResult.toolCallId === toolCall.toolCallId,
            // );

            switch (toolCall.toolName) {
              case "initializeProject": {
                await db
                  .update(projects)
                  .set({
                    name: toolCall.args.name,
                    description: toolCall.args.description,
                    initiatedAt: new Date(),
                  })
                  .where(eq(projects.id, projectId));

                // TODO: prepare the boilerplate

                // TODO: call the architect to plan the implementation

                // TODO: call the coder to code the implementation

                break;
              }
              // case "setupResource": {
              //   stream.update({
              //     type: "text",
              //     text: "Please, complete the database setup to continue.",
              //   });
              //   stream.update({
              //     type: "tool",
              //     toolName: toolCall.toolName,
              //     toolArgs: toolCall.args,
              //     toolResult: toolResult?.result,
              //   });
              //   messages.push({
              //     role: "assistant",
              //     rawContent: [
              //       {
              //         type: "paragraph",
              //         value: "Please, complete the database setup to continue.",
              //       },
              //     ],
              //   });
              //   break;
              // }
              case "implement": {
                // TODO: call the architect to plan the implementation

                // TODO: call the coder to code the implementation

                break;
              }
            }

            messages.push({
              role: "tool",
              rawContent: {
                toolName: toolCall.toolName,
                toolArgs: toolCall.args,
                // toolResult: toolResult?.result,
              },
            });

            if (text) {
              messages.push({
                role: "assistant",
                rawContent: [{ type: "paragraph", value: text }],
              });
            }
          }
        }

        if (finishReason === "stop" && text) {
          messages.push({
            role: "assistant",
            rawContent: [{ type: "paragraph", value: text }],
          });
        }

        if (messages.length > 0) {
          await api.chats.addMessage({
            chatId,
            messages,
          });
        }
      },
    });

    for await (const text of textStream) {
      stream.update({
        type: "text",
        text,
      });
    }
  })();

  return stream.value;
}
