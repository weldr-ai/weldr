import { eq } from "@integramind/db";
import { edges, insertEdgeSchema } from "@integramind/db/schema";
import { z } from "zod";
import { protectedProcedure } from "../trpc";

export const edgesRouter = {
  create: protectedProcedure
    .input(insertEdgeSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.db.insert(edges).values({
        ...input,
      });
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(edges).where(eq(edges.id, input.id));
    }),
};
