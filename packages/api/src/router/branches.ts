import { TRPCError } from "@trpc/server";
import z from "zod";

import { and, eq, type SQL } from "@weldr/db";
import { branches } from "@weldr/db/schema";
import { Tigris } from "@weldr/shared/tigris";
import type {
  AssistantMessage,
  ChatMessage,
  ToolMessage,
} from "@weldr/shared/types";

import { protectedProcedure } from "../init";

export const branchRouter = {
  byIdOrMain: protectedProcedure
    .input(z.object({ id: z.string().optional(), projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const where: SQL[] = [
        eq(branches.userId, ctx.session.user.id),
        eq(branches.projectId, input.projectId),
      ];

      if (input.id) {
        where.push(eq(branches.id, input.id));
      } else {
        where.push(eq(branches.isMain, true));
      }

      const branch = await ctx.db.query.branches.findFirst({
        where: and(...where),
        with: {
          headVersion: {
            columns: {
              id: true,
              message: true,
              createdAt: true,
              parentVersionId: true,
              number: true,
              status: true,
              description: true,
              projectId: true,
              publishedAt: true,
            },
            with: {
              chat: {
                with: {
                  messages: {
                    orderBy: (messages, { asc }) => [asc(messages.createdAt)],
                    with: {
                      attachments: {
                        columns: {
                          name: true,
                          key: true,
                        },
                      },
                      user: {
                        columns: {
                          name: true,
                        },
                      },
                    },
                  },
                },
              },
              declarations: {
                with: {
                  declaration: {
                    columns: {
                      id: true,
                      metadata: true,
                      nodeId: true,
                      progress: true,
                    },
                    with: {
                      node: true,
                      dependencies: true,
                    },
                  },
                },
              },
            },
          },
          versions: true,
        },
      });

      if (!branch || !branch.headVersion) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Branch not found",
        });
      }
      const getMessagesWithAttachments = async (
        version: typeof branch.headVersion,
      ) => {
        const results = [];

        for (const message of version.chat.messages) {
          // Filter assistant messages for call_coder tool calls
          let content = message.content as
            | ToolMessage["content"]
            | AssistantMessage["content"];

          // Skip tool messages with call_coder results
          if (message.role === "tool" && Array.isArray(message.content)) {
            content = content.filter(
              (item) =>
                !(
                  item?.type === "tool-result" &&
                  item?.toolName === "call_coder"
                ),
            );
          } else if (message.role === "assistant") {
            content = content.filter(
              (item) =>
                !(
                  item?.type === "tool-call" && item?.toolName === "call_coder"
                ),
            );
          }

          if (content.length === 0) continue;

          // Get attachment URLs
          const attachmentsWithUrls = await Promise.all(
            message.attachments.map(async (attachment) => ({
              name: attachment.name,
              url: await Tigris.object.getSignedUrl(
                // biome-ignore lint/style/noNonNullAssertion: reason
                process.env.GENERAL_BUCKET!,
                attachment.key,
              ),
            })),
          );

          results.push({
            ...message,
            content,
            attachments: attachmentsWithUrls,
          });
        }

        return results;
      };

      return {
        ...branch,
        headVersion: {
          ...branch.headVersion,
          chat: {
            ...branch.headVersion.chat,
            messages: (await getMessagesWithAttachments(
              branch.headVersion,
            )) as ChatMessage[],
          },
        },
      };
    }),
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.branches.findMany({
      with: {
        versions: true,
      },
    });
  }),
};
