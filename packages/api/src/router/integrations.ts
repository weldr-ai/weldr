import type { TRPCRouterRecord } from "@trpc/server";
import { protectedProcedure } from "../trpc";

export const integrationsRouter = {
  getAll: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.db.query.integrations.findMany({
      columns: {
        dependencies: false,
      },
    });
  }),
  getAllWithDependencies: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.db.query.integrations.findMany();
  }),
} satisfies TRPCRouterRecord;
