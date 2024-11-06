import { conversationMessages } from "@specly/db/schema";
import { conversationMessageSchema } from "@specly/shared/validators/conversations";
import type { TRPCRouterRecord } from "@trpc/server";
import { protectedProcedure } from "../trpc";

export const conversationsRouter = {
  addMessage: protectedProcedure
    .input(conversationMessageSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.db.insert(conversationMessages).values({
        id: input.id,
        content: input.content,
        rawContent: input.rawContent,
        role: input.role,
        createdAt: input.createdAt,
        updatedAt: input.updatedAt,
        createdBy: ctx.session.user.id,
        conversationId: input.conversationId,
      });
    }),
} satisfies TRPCRouterRecord;
