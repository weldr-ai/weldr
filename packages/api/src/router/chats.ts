import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { chatMessages, chats } from "@weldr/db/schema";
import { mergeJson } from "@weldr/db/utils";
import { Tigris } from "@weldr/shared/tigris";
import type { ChatMessage } from "@weldr/shared/types";
import {
  addMessagesInputSchema,
  toolResultPartSchema,
} from "@weldr/shared/validators/chats";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure } from "../init";

export const chatsRouter = {
  messages: protectedProcedure
    .input(z.object({ chatId: z.string() }))
    .query(async ({ ctx, input }) => {
      const messages = await ctx.db.query.chatMessages.findMany({
        where: and(
          eq(chatMessages.chatId, input.chatId),
          eq(chatMessages.userId, ctx.session.user.id),
        ),
        orderBy: (chatMessages, { asc }) => [asc(chatMessages.createdAt)],
        columns: {
          content: false,
        },
        with: {
          attachments: {
            columns: {
              name: true,
              key: true,
            },
          },
          user: {
            columns: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      });

      const messagesWithAttachments = await Promise.all(
        messages.map(async (message) => {
          const attachments = [];

          for (const attachment of message.attachments) {
            const url = await Tigris.object.getSignedUrl(
              // biome-ignore lint/style/noNonNullAssertion: <explanation>
              process.env.GENERAL_BUCKET!,
              attachment.key,
            );

            attachments.push({
              name: attachment.name,
              url,
            });
          }

          return {
            ...message,
            attachments,
          };
        }),
      );

      return messagesWithAttachments as ChatMessage[];
    }),
  addMessage: protectedProcedure
    .input(addMessagesInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (input.messages.length === 0) {
        return;
      }

      const chat = await ctx.db.query.chats.findFirst({
        where: and(
          eq(chats.id, input.chatId),
          eq(chats.userId, ctx.session.user.id),
        ),
      });

      if (!chat) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Chat not found",
        });
      }

      const messages: (typeof chatMessages.$inferInsert)[] = [];

      for (const item of input.messages) {
        messages.push({
          type: "public",
          content: item.content,
          role: item.role,
          userId: ctx.session.user.id,
          chatId: input.chatId,
        });
      }

      await ctx.db.insert(chatMessages).values(messages);
    }),
  updateToolMessage: protectedProcedure
    .input(
      z.object({
        where: z.object({
          messageId: z.string(),
        }),
        data: z.object({
          content: z.array(toolResultPartSchema),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [message] = await ctx.db
        .update(chatMessages)
        .set({
          content: mergeJson(chatMessages.content, input.data.content),
        })
        .where(
          and(
            eq(chatMessages.id, input.where.messageId),
            eq(chatMessages.userId, ctx.session.user.id),
          ),
        )
        .returning();

      if (!message) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Message not found",
        });
      }

      return message;
    }),
} satisfies TRPCRouterRecord;
