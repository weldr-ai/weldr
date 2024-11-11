import { eq } from "@integramind/db";
import { integrationUtils, integrations } from "@integramind/db/schema";
import { TRPCError, type TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure } from "../trpc";

export const integrationsRouter = {
  getAll: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.db.query.integrations.findMany();
  }),
  getAllWithDependencies: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.db.query.integrations.findMany();
  }),
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db.query.integrations.findFirst({
        where: eq(integrations.id, input.id),
      });

      if (!result) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Integration not found",
        });
      }

      return result;
    }),
  getUtilityById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db.query.integrationUtils.findFirst({
        where: eq(integrationUtils.id, input.id),
      });

      if (!result) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Utility not found",
        });
      }

      return result;
    }),
} satisfies TRPCRouterRecord;
