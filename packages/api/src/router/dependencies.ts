import type { TRPCRouterRecord } from "@trpc/server";
import { eq } from "@weldr/db";
import { declarations } from "node_modules/@weldr/db/src/schema/declarations";
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
      const func = await ctx.db.query.declarations.findFirst({
        where: eq(declarations.id, input.dependentId),
        with: {
          dependencies: true,
        },
      });

      const existingDeps = func?.dependencies ?? [];

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
      const availableFunctions = await ctx.db.query.declarations.findMany({
        where: eq(declarations.userId, ctx.session.user.id),
        with: {
          dependencies: true,
        },
      });

      return availableFunctions.filter((f) => {
        // For functions: prevent self-deps and cycles
        return f.id !== input.dependentId && !dependencyChain.has(f.id);
      });
    }),
} satisfies TRPCRouterRecord;
