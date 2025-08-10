import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { eq } from "@weldr/db";
import { nodes } from "@weldr/db/schema";

import { protectedProcedure } from "../init";

export const nodesRouter = {
  byId: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const canvasNode = await ctx.db.query.nodes.findFirst({
        where: eq(nodes.id, input.id),
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
        .update(nodes)
        .set({
          position: input.payload.position,
        })
        .where(eq(nodes.id, input.where.id));

      if (!canvasNode) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Canvas node not found",
        });
      }

      return canvasNode;
    }),
};
