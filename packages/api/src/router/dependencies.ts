import { eq } from "@integramind/db";
import { dependencies, primitives } from "@integramind/db/schema";
import { TRPCError, type TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure } from "../trpc";
import { wouldCreateCycle } from "../utils";

export const dependenciesRouter = {
  create: protectedProcedure
    .input(
      z.object({
        targetPrimitiveId: z.string(),
        sourceUtilityId: z.string().optional(),
        sourcePrimitiveId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (
        input.sourcePrimitiveId &&
        (await wouldCreateCycle(
          input.sourcePrimitiveId,
          input.targetPrimitiveId,
        ))
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cycle detected",
        });
      }
      await ctx.db.insert(dependencies).values(input).onConflictDoNothing();
    }),
  available: protectedProcedure
    .input(z.object({ primitiveId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Get all existing dependencies for this primitive
      const existingDeps = await ctx.db.query.dependencies.findMany({
        where: eq(dependencies.sourcePrimitiveId, input.primitiveId),
        columns: {
          targetPrimitiveId: true,
        },
      });

      // Get all primitives that this primitive depends on (directly or indirectly)
      const dependencyChain = new Set<string>();
      const queue = existingDeps.map((d) => d.targetPrimitiveId);

      while (queue.length > 0) {
        const currentId = queue.shift();
        if (currentId && !dependencyChain.has(currentId)) {
          dependencyChain.add(currentId);
          const deps = await ctx.db.query.dependencies.findMany({
            where: eq(dependencies.sourcePrimitiveId, currentId),
            columns: {
              targetPrimitiveId: true,
            },
          });
          queue.push(...deps.map((d) => d.targetPrimitiveId));
        }
      }

      // Get all primitives except those that would create cycles
      const availablePrimitives = await ctx.db.query.primitives.findMany({
        where: eq(primitives.userId, ctx.session.user.id),
      });

      return availablePrimitives.filter(
        (p) =>
          p.id !== input.primitiveId && // Can't depend on itself
          p.name &&
          p.description &&
          p.rawDescription &&
          p.logicalSteps &&
          p.edgeCases &&
          p.errorHandling &&
          p.code &&
          !dependencyChain.has(p.id) && // Can't create cycles
          !existingDeps.some((d) => d.targetPrimitiveId === p.id), // Not already a dependency
      );
    }),
} satisfies TRPCRouterRecord;
