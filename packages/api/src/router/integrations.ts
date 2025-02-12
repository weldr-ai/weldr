import { TRPCError, type TRPCRouterRecord } from "@trpc/server";
import { eq } from "@weldr/db";
import { integrations } from "@weldr/db/schema";
import { integrationTypeSchema } from "@weldr/shared/validators/integrations";
import { z } from "zod";
import { protectedProcedure } from "../trpc";

export const integrationsRouter = {
  list: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.db.query.integrations.findMany();
  }),
  byType: protectedProcedure
    .input(z.object({ type: integrationTypeSchema }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db.query.integrations.findFirst({
        where: eq(integrations.type, input.type),
      });

      if (!result) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Integration not found",
        });
      }

      return result;
    }),
  byId: protectedProcedure
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
} satisfies TRPCRouterRecord;
