import { eq } from "@integramind/db";
import { edges, funcs } from "@integramind/db/schema";
import type { Func } from "@integramind/shared/types";
import { createEdgeSchema } from "@integramind/shared/validators/edges";
import { TRPCError, type TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure } from "../trpc";
import { wouldCreateCycle } from "../utils";

export const edgesRouter = {
  listByFlowId: protectedProcedure
    .input(z.object({ flowId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.edges.findMany({
        where: eq(edges.flowId, input.flowId),
      });
    }),
  create: protectedProcedure
    .input(createEdgeSchema)
    .mutation(async ({ ctx, input }) => {
      if (
        input.localSourceId &&
        (await wouldCreateCycle({
          localSourceId: input.localSourceId,
          targetId: input.targetId,
        }))
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "The provided dependencies will cause a circular dependency in the flow",
        });
      }
      await ctx.db.insert(edges).values(input).onConflictDoNothing();
    }),
  createBulk: protectedProcedure
    .input(
      z
        .object({
          type: z.enum(["consumes", "requires"]),
          targetId: z.string(),
          localSourceId: z.string().optional(),
          importedSourceId: z.string().optional(),
          flowId: z.string(),
        })
        .array(),
    )
    .mutation(async ({ ctx, input }) => {
      for (const dep of input) {
        if (
          dep.localSourceId &&
          (await wouldCreateCycle({
            localSourceId: dep.localSourceId,
            targetId: dep.targetId,
          }))
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "The provided dependencies will cause a circular dependency in the flow",
          });
        }
      }
      await ctx.db.insert(edges).values(input).onConflictDoNothing();
    }),
  available: protectedProcedure
    .input(z.object({ funcId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Get all existing dependencies for this function
      const existingDeps = await ctx.db.query.edges.findMany({
        where: eq(edges.localSourceId, input.funcId),
        columns: {
          targetId: true,
        },
      });

      // Get all functions that this function depends on (directly or indirectly)
      const dependencyChain = new Set<string>();
      const queue = existingDeps.map((d) => d.targetId);

      while (queue.length > 0) {
        const currentId = queue.shift();
        if (currentId && !dependencyChain.has(currentId)) {
          dependencyChain.add(currentId);
          const deps = await ctx.db.query.edges.findMany({
            where: eq(edges.localSourceId, currentId),
            columns: {
              targetId: true,
            },
          });
          queue.push(...deps.map((d) => d.targetId));
        }
      }

      // Get all functions except those that would create cycles
      const availableFunctions = (await ctx.db.query.funcs.findMany({
        where: eq(funcs.userId, ctx.session.user.id),
      })) as Func[];

      return availableFunctions.filter(
        (f) =>
          f.id !== input.funcId && // Can't depend on itself
          f.name &&
          f.description &&
          f.rawDescription &&
          f.logicalSteps &&
          f.edgeCases &&
          f.errorHandling &&
          f.code &&
          !dependencyChain.has(f.id) && // Can't create cycles
          !existingDeps.some((d) => d.targetId === f.id), // Not already a dependency
      );
    }),
} satisfies TRPCRouterRecord;
