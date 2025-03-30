import { TRPCError } from "@trpc/server";
import { eq } from "@weldr/db";
import { canvasNodes } from "@weldr/db/schema";
import { z } from "zod";
import { protectedProcedure } from "../trpc";

export const canvasNodeRouter = {
  byId: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const canvasNode = await ctx.db.query.canvasNodes.findFirst({
        where: eq(canvasNodes.id, input.id),
      });

      if (!canvasNode) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Canvas node not found",
        });
      }

      return canvasNode;
    }),
  update: protectedProcedure
    .input(
      z.object({
        where: z.object({
          id: z.string(),
        }),
        payload: z.object({
          position: z.object({ x: z.number(), y: z.number() }),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const canvasNode = await ctx.db
        .update(canvasNodes)
        .set({
          position: input.payload.position,
        })
        .where(eq(canvasNodes.id, input.where.id));

      if (!canvasNode) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Canvas node not found",
        });
      }

      return canvasNode;
    }),
};
