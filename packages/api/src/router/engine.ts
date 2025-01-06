import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure } from "../trpc";

export const engineRouter = {
  executeFunc: protectedProcedure
    .input(
      z.object({
        funcId: z.string(),
        input: z.record(z.any()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {}),
  patch: protectedProcedure
    .input(
      z.object({
        funcId: z.string(),
        input: z.record(z.any()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {}),
} satisfies TRPCRouterRecord;
