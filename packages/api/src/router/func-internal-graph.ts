import { eq } from "@integramind/db";
import {
  funcInternalGraph,
  funcInternalGraphEdges,
  funcs,
} from "@integramind/db/schema";
import { insertFuncInternalGraphEdgeSchema } from "@integramind/shared/validators/func-internal-graph";
import { TRPCError, type TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure } from "../trpc";

export const funcInternalGraphRouter = {
  addEdges: protectedProcedure
    .input(
      z.object({
        funcId: z.string(),
        edges: insertFuncInternalGraphEdgeSchema.array(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const func = await ctx.db.query.funcs.findFirst({
          where: eq(funcs.id, input.funcId),
        });

        if (!func) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Function not found",
          });
        }

        let funcInternalGraphResult = undefined;

        funcInternalGraphResult =
          await ctx.db.query.funcInternalGraph.findFirst({
            where: eq(funcInternalGraph.funcId, input.funcId),
          });

        if (!funcInternalGraphResult) {
          funcInternalGraphResult = await ctx.db
            .insert(funcInternalGraph)
            .values({ funcId: input.funcId })
            .returning();
        }

        await ctx.db
          .insert(funcInternalGraphEdges)
          .values(input.edges)
          .returning();
      } catch (error) {
        console.error(error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Internal server error",
        });
      }
    }),
} satisfies TRPCRouterRecord;
