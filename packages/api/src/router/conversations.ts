import { conversationMessages, conversations } from "@integramind/db/schema";
import { conversationMessageSchema } from "@integramind/shared/validators/conversations";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure } from "../trpc";

export const conversationsRouter = {
  addMessage: protectedProcedure
    .input(
      conversationMessageSchema.extend({
        conversationId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const conversation = await ctx.db.query.conversations.findFirst({
        where: and(
          eq(conversations.id, input.conversationId),
          eq(conversations.userId, ctx.session.user.id),
        ),
      });

      if (!conversation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conversation not found",
        });
      }

      await ctx.db.insert(conversationMessages).values({
        id: input.id,
        content: input.content,
        rawContent: input.rawContent,
        role: input.role,
        createdAt: input.createdAt,
        userId: ctx.session.user.id,
        conversationId: input.conversationId,
      });
    }),
} satisfies TRPCRouterRecord;
