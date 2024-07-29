import { and, eq } from "@integramind/db";
import { edges } from "@integramind/db/schema";
import { insertEdgeSchema } from "@integramind/shared/validators/edges";
import { z } from "zod";
import { protectedProcedure } from "../trpc";

export const edgesRouter = {
  create: protectedProcedure
    .input(insertEdgeSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.db.insert(edges).values({
        ...input,
        createdBy: ctx.session.user.id,
      });
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(edges)
        .where(
          and(eq(edges.id, input.id), eq(edges.createdBy, ctx.session.user.id)),
        );
    }),
};
