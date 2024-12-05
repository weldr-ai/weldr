import { eq } from "@integramind/db";
import { testRuns } from "@integramind/db/schema";
import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure } from "../trpc";

export const testRunsRouter = {
  listByPrimitiveId: protectedProcedure
    .input(z.object({ primitiveId: z.string() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db.query.testRuns.findMany({
        where: eq(testRuns.primitiveId, input.primitiveId),
      });

      return result;
    }),
} satisfies TRPCRouterRecord;
