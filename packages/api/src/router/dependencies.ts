import type { TRPCRouterRecord } from "@trpc/server";
import { eq } from "@weldr/db";
import { funcs } from "@weldr/db/schema";
import { z } from "zod";
import { protectedProcedure } from "../trpc";

export const dependenciesRouter = {
  available: protectedProcedure
    .input(
      z.object({
        dependentType: z.enum(["function", "endpoint"]),
        dependentId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const func = await ctx.db.query.funcs.findFirst({
        where: eq(funcs.id, input.dependentId),
        with: {
          currentDefinition: {
            with: {
              funcDefinitionDependencies: true,
            },
          },
        },
      });

      const existingDeps =
        func?.currentDefinition?.funcDefinitionDependencies ?? [];

      // For functions, we need to check the dependency chain to prevent cycles
      const dependencyChain = new Set<string>();

      if (input.dependentType === "function") {
        const queue = existingDeps.map((d) => d.dependencyDefinitionId);

        while (queue.length > 0) {
          const currentId = queue.shift();
          if (currentId && !dependencyChain.has(currentId)) {
            dependencyChain.add(currentId);
            const deps = await ctx.db.query.dependencies.findMany({
              where: (table, { and, eq }) =>
                and(
                  eq(table.dependentDefinitionId, currentId),
                  eq(table.dependentType, "function"),
                ),
              columns: {
                dependencyDefinitionId: true,
              },
            });
            queue.push(...deps.map((d) => d.dependencyDefinitionId));
          }
        }
      }

      // Get all available functions that can be dependencies
      const availableFunctions = await ctx.db.query.funcs.findMany({
        where: eq(funcs.userId, ctx.session.user.id),
        with: {
          currentDefinition: true,
        },
      });

      return availableFunctions.filter((f) => {
        // Basic validation
        if (!f.currentDefinition) return false;

        // Already a dependency
        if (existingDeps.some((d) => d.dependencyDefinitionId === f.id))
          return false;

        // For functions: prevent self-deps and cycles
        if (input.dependentType === "function") {
          return f.id !== input.dependentId && !dependencyChain.has(f.id);
        }

        // For endpoints: allow any function
        return true;
      });
    }),
} satisfies TRPCRouterRecord;
