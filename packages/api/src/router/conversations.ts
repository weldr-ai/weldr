import { z } from "zod";

import { conversationMessages } from "@specly/db/schema";
import { rawDescriptionSchema } from "@specly/shared/validators/common";
import { protectedProcedure } from "../trpc";

export const conversationsRouter = {
  addMessage: protectedProcedure
    .input(
      z.object({
        role: z.enum(["user", "assistant"]),
        conversationId: z.string(),
        content: z.string(),
        rawContent: rawDescriptionSchema.array().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db.insert(conversationMessages).values({
        content: input.content,
        rawContent: input.rawContent ?? [],
        role: input.role,
        createdBy: ctx.session.user.id,
        conversationId: input.conversationId,
      });
    }),
};
