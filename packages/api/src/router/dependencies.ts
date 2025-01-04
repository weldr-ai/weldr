import { and, eq } from "@integramind/db";
import { dependencies, funcs } from "@integramind/db/schema";
import { TRPCError, type TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure } from "../trpc";
import { isFunctionReady, wouldCreateCycle } from "../utils";

export const dependenciesRouter = {
  createBulk: protectedProcedure
    .input(
      z.object({
        dependentType: z.enum(["function", "endpoint"]),
        dependentVersionId: z.string(),
        dependencyVersionIds: z.array(z.string()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // First delete all existing dependencies
      await ctx.db
        .delete(dependencies)
        .where(
          and(
            eq(dependencies.dependentVersionId, input.dependentVersionId),
            eq(dependencies.dependentType, input.dependentType),
          ),
        );

      if (input.dependentType === "function") {
        for (const dep of input.dependencyVersionIds) {
          const isCyclic = await wouldCreateCycle({
            dependentVersionId: input.dependentVersionId,
            dependencyVersionId: dep,
          });

          if (isCyclic) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                "The provided dependencies will cause a circular dependency",
            });
          }
        }
      }

      await ctx.db
        .insert(dependencies)
        .values(
          input.dependencyVersionIds.map((dep) => ({
            dependentType: input.dependentType,
            dependentVersionId: input.dependentVersionId,
            dependencyVersionId: dep,
          })),
        )
        .onConflictDoNothing();
    }),
  available: protectedProcedure
    .input(
      z.object({
        dependentType: z.enum(["function", "endpoint"]),
        dependentVersionId: z.string().nullable().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const dependentVersionId = input.dependentVersionId;

      // If no dependent version id is provided, return all available functions
      if (!dependentVersionId) {
        return await ctx.db.query.funcs.findMany({
          where: eq(funcs.userId, ctx.session.user.id),
          columns: {
            id: true,
            name: true,
          },
        });
      }

      // Get all existing dependencies for this entity
      const existingDeps = await ctx.db.query.dependencies.findMany({
        where: (table, { and, eq }) =>
          and(
            eq(table.dependentVersionId, dependentVersionId),
            eq(table.dependentType, input.dependentType),
          ),
        columns: {
          dependencyVersionId: true,
        },
      });

      // For functions, we need to check the dependency chain to prevent cycles
      const dependencyChain = new Set<string>();
      if (input.dependentType === "function") {
        const queue = existingDeps.map((d) => d.dependencyVersionId);

        while (queue.length > 0) {
          const currentId = queue.shift();
          if (currentId && !dependencyChain.has(currentId)) {
            dependencyChain.add(currentId);
            const deps = await ctx.db.query.dependencies.findMany({
              where: (table, { and, eq }) =>
                and(
                  eq(table.dependentVersionId, currentId),
                  eq(table.dependentType, "function"),
                ),
              columns: {
                dependencyVersionId: true,
              },
            });
            queue.push(...deps.map((d) => d.dependencyVersionId));
          }
        }
      }

      // Get all available functions that can be dependencies
      const availableFunctions = await ctx.db.query.funcs.findMany({
        where: eq(funcs.userId, ctx.session.user.id),
        columns: {
          id: true,
          name: true,
          currentVersionId: true,
        },
      });

      if (input.dependentType === "function") {
        const result: {
          id: string;
          name: string;
        }[] = [];

        for (const func of availableFunctions) {
          // Check if the function has a current version
          if (!func.currentVersionId) continue;

          // Already a dependency
          if (
            existingDeps.some(
              (d) => d.dependencyVersionId === func.currentVersionId,
            )
          )
            continue;

          // For functions: prevent self-deps and cycles
          if (input.dependentType === "function") {
            if (
              func.currentVersionId !== input.dependentVersionId &&
              !dependencyChain.has(func.currentVersionId)
            )
              continue;
          }

          // Check if the function is ready
          const isReady = await isFunctionReady({ id: func.id });
          if (!isReady) continue;

          result.push({
            id: func.id,
            name: func.name ?? "",
          });
        }

        return result;
      }

      return availableFunctions.filter((f) =>
        existingDeps.some((d) => d.dependencyVersionId !== f.currentVersionId),
      );
    }),
} satisfies TRPCRouterRecord;
