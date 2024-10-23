import { z } from "zod";

import { conversationMessages } from "@specly/db/schema";
import { rawDescriptionSchema } from "@specly/shared/validators/common";
import { protectedProcedure } from "../trpc";

export const conversationsRouter = {
  addMessage: protectedProcedure
    .input(
      z.object({
        id: z.string().optional(),
        role: z.enum(["user", "assistant"]),
        content: z.string(),
        rawContent: rawDescriptionSchema.array().optional(),
        createdAt: z.date().optional(),
        updatedAt: z.date().optional(),
        conversationId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db.insert(conversationMessages).values({
        id: input.id,
        content: input.content,
        rawContent: input.rawContent ?? [],
        role: input.role,
        createdAt: input.createdAt,
        updatedAt: input.updatedAt,
        createdBy: ctx.session.user.id,
        conversationId: input.conversationId,
      });
    }),
};
