import { and, eq } from "@integramind/db";
import { dependencies, funcs } from "@integramind/db/schema";
import { TRPCError, type TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure } from "../trpc";
import { wouldCreateCycle } from "../utils";

export const dependenciesRouter = {
  createBulk: protectedProcedure
    .input(
      z.object({
        dependentId: z.string(),
        dependentType: z.enum(["function", "endpoint"]),
        dependencies: z.array(
          z.object({
            id: z.string(),
            type: z.enum(["function", "endpoint"]),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // First delete all existing dependencies
      await ctx.db
        .delete(dependencies)
        .where(
          and(
            eq(dependencies.dependentId, input.dependentId),
            eq(dependencies.dependentType, input.dependentType),
          ),
        );

      if (input.dependentType === "function") {
        for (const dep of input.dependencies) {
          const isCyclic = await wouldCreateCycle({
            dependentId: input.dependentId,
            dependentType: input.dependentType,
            dependencyId: dep.id,
            dependencyType: dep.type,
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
          input.dependencies.map((dep) => ({
            dependentType: input.dependentType,
            dependentId: input.dependentId,
            dependencyType: dep.type,
            dependencyId: dep.id,
          })),
        )
        .onConflictDoNothing();
    }),
  available: protectedProcedure
    .input(
      z.object({
        dependentType: z.enum(["function", "endpoint"]),
        dependentId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Get all existing dependencies for this entity
      const existingDeps = await ctx.db.query.dependencies.findMany({
        where: eq(dependencies.dependentId, input.dependentId),
        columns: {
          dependencyId: true,
        },
      });

      // For functions, we need to check the dependency chain to prevent cycles
      const dependencyChain = new Set<string>();

      if (input.dependentType === "function") {
        const queue = existingDeps.map((d) => d.dependencyId);

        while (queue.length > 0) {
          const currentId = queue.shift();
          if (currentId && !dependencyChain.has(currentId)) {
            dependencyChain.add(currentId);
            const deps = await ctx.db.query.dependencies.findMany({
              where: (table, { and, eq }) =>
                and(
                  eq(table.dependentId, currentId),
                  eq(table.dependentType, "function"),
                ),
              columns: {
                dependencyId: true,
              },
            });
            queue.push(...deps.map((d) => d.dependencyId));
          }
        }
      }

      // Get all available functions that can be dependencies
      const availableFunctions = await ctx.db.query.funcs.findMany({
        where: eq(funcs.userId, ctx.session.user.id),
        columns: {
          id: true,
          name: true,
          rawDescription: true,
          code: true,
        },
      });

      return availableFunctions.filter((f) => {
        // Basic validation
        if (!f.code) return false;

        // Already a dependency
        if (existingDeps.some((d) => d.dependencyId === f.id)) return false;

        // For functions: prevent self-deps and cycles
        if (input.dependentType === "function") {
          return f.id !== input.dependentId && !dependencyChain.has(f.id);
        }

        // For endpoints: allow any function
        return true;
      });
    }),
} satisfies TRPCRouterRecord;
