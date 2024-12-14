import { eq } from "@integramind/db";
import { testRuns } from "@integramind/db/schema";
import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure } from "../trpc";

export const testRunsRouter = {
  listByFuncId: protectedProcedure
    .input(z.object({ funcId: z.string() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db.query.testRuns.findMany({
        where: eq(testRuns.funcId, input.funcId),
      });

      return result;
    }),
} satisfies TRPCRouterRecord;
