import { conversationMessages } from "@integramind/db/schema";
import { conversationMessageSchema } from "@integramind/shared/validators/conversations";
import type { TRPCRouterRecord } from "@trpc/server";
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
