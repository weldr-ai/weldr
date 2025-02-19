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
import { implement, initializeProject, setupResource } from "../tools";
import { architect } from "./architect";
import { coder } from "./coder";

export async function requirementsGatherer(chatId: string, projectId: string) {
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

    if (message.content === null || message.role === "version") continue;

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
      system: prompts.requirementsGatherer,
      messages: promptMessages,
      experimental_activeTools: project.initiatedAt
        ? ["implement", "setupResource"]
        : ["initializeProject", "setupResource"],
      tools: { implement, initializeProject, setupResource },
      maxSteps: 3,
      onFinish: async ({ text, finishReason, toolCalls, toolResults }) => {
        const messages: z.infer<typeof addMessageItemSchema>[] = [];

        if (finishReason === "tool-calls") {
          for (const toolCall of toolCalls) {
            const toolResult = toolResults.find(
              (toolResult) => toolResult.toolCallId === toolCall.toolCallId,
            );

            switch (toolCall.toolName) {
              case "initializeProject": {
                console.log(
                  "--------------- INITIALIZE PROJECT -----------------",
                );
                console.log(text);
                console.log(toolCall);

                // await db
                //   .update(projects)
                //   .set({
                //     name: toolCall.args.name,
                //     initiatedAt: new Date(),
                //   })
                //   .where(eq(projects.id, projectId));

                await coder(
                  {
                    role: "user",
                    content: `Please, create this new app: ${toolCall.args.requirements}`,
                  },
                  `The codebase is currently an empty Next.js app with only configuration files and shadcn/ui components.
                  But doesn't have any layouts, pages, or api routes. More details:

                  - Here is the current folder structure:
                  /src
                    /app (empty folder)
                    /components/ui (all the shadcn/ui components)
                    /hooks
                      /use-mobile.ts (mobile detection hook)
                      /use-toast.ts (toast hook)
                    /lib
                      /utils.ts (utility functions)
                    /public (static assets)
                    /styles
                      global.css
                  ...config files

                  Installed NPM Packages:
                  Runtime Dependencies:
                  - @hookform/resolvers
                  - @radix-ui/react-accordion
                  - @radix-ui/react-alert-dialog
                  - @radix-ui/react-aspect-ratio
                  - @radix-ui/react-avatar
                  - @radix-ui/react-checkbox
                  - @radix-ui/react-collapsible
                  - @radix-ui/react-context-menu
                  - @radix-ui/react-dialog
                  - @radix-ui/react-dropdown-menu
                  - @radix-ui/react-hover-card
                  - @radix-ui/react-label
                  - @radix-ui/react-menubar
                  - @radix-ui/react-navigation-menu
                  - @radix-ui/react-popover
                  - @radix-ui/react-progress
                  - @radix-ui/react-radio-group
                  - @radix-ui/react-scroll-area
                  - @radix-ui/react-select
                  - @radix-ui/react-separator
                  - @radix-ui/react-slider
                  - @radix-ui/react-slot
                  - @radix-ui/react-switch
                  - @radix-ui/react-tabs
                  - @radix-ui/react-toast
                  - @radix-ui/react-toggle
                  - @radix-ui/react-toggle-group
                  - @radix-ui/react-tooltip
                  - class-variance-authority
                  - clsx
                  - cmdk
                  - date-fns
                  - embla-carousel-react
                  - input-otp
                  - lucide-react
                  - next
                  - next-themes
                  - react
                  - react-day-picker
                  - react-dom
                  - react-hook-form
                  - react-resizable-panels
                  - recharts
                  - server-only
                  - sonner
                  - tailwind-merge
                  - tailwindcss-animate
                  - vaul
                  - zod

                  Dev Dependencies:
                  - @types/eslint
                  - @types/node
                  - @types/react
                  - @types/react-dom
                  - @typescript-eslint/eslint-plugin
                  - @typescript-eslint/parser
                  - eslint
                  - eslint-config-next
                  - postcss
                  - prettier
                  - prettier-plugin-tailwindcss
                  - tailwindcss
                  - typescript`,
                );

                break;
              }
              case "setupResource": {
                stream.update({
                  type: "text",
                  text: "Please, complete the database setup to continue.",
                });
                stream.update({
                  type: "tool",
                  toolName: toolCall.toolName,
                  toolArgs: toolCall.args,
                  toolResult: toolResult?.result,
                });
                messages.push({
                  role: "assistant",
                  rawContent: [
                    {
                      type: "paragraph",
                      value: "Please, complete the database setup to continue.",
                    },
                  ],
                });
                break;
              }
              case "implement": {
                await architect(
                  {
                    role: "user",
                    content: toolCall.args.requirements,
                  },
                  "The codebase is currently a basic boilerplate Next.js app with tailwindcss and all the shadcn/ui components installed.",
                );
                break;
              }
            }

            if (text) {
              console.log("--------------- TEXT -----------------");
              console.log(text);
              messages.push({
                role: "assistant",
                rawContent: [{ type: "paragraph", value: text }],
              });
            }

            messages.push({
              role: "tool",
              rawContent: {
                toolName: toolCall.toolName,
                toolArgs: toolCall.args,
                toolResult: toolResult?.result,
              },
            });
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
