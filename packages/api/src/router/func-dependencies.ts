import { eq } from "@integramind/db";
import { funcDependencies, funcs, projects } from "@integramind/db/schema";
import { TRPCError, type TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure } from "../trpc";
import { wouldCreateCycle } from "../utils";

export const funcDependenciesRouter = {
  create: protectedProcedure
    .input(z.object({ funcId: z.string(), dependencyFuncId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (
        await wouldCreateCycle({
          funcId: input.funcId,
          dependencyFuncId: input.dependencyFuncId,
        })
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "The provided dependencies will cause a circular dependency",
        });
      }
      await ctx.db.insert(funcDependencies).values(input).onConflictDoNothing();
    }),
  createBulk: protectedProcedure
    .input(
      z.object({
        funcId: z.string(),
        dependencyFuncIds: z.array(z.string()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      for (const dep of input.dependencyFuncIds) {
        const isCyclic = await wouldCreateCycle({
          funcId: input.funcId,
          dependencyFuncId: dep,
        });

        if (isCyclic) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "The provided dependencies will cause a circular dependency",
          });
        }
      }

      await ctx.db
        .insert(funcDependencies)
        .values(
          input.dependencyFuncIds.map((dep) => ({
            funcId: input.funcId,
            dependencyFuncId: dep,
          })),
        )
        .onConflictDoNothing();
    }),
  available: protectedProcedure
    .input(z.object({ funcId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Get all existing dependencies for this function
      const existingDeps = await ctx.db.query.funcDependencies.findMany({
        where: eq(funcDependencies.funcId, input.funcId),
        columns: {
          dependencyFuncId: true,
        },
      });

      // Get all functions that this function depends on (directly or indirectly)
      const dependencyChain = new Set<string>();
      const queue = existingDeps.map((d) => d.dependencyFuncId);

      while (queue.length > 0) {
        const currentId = queue.shift();
        if (currentId && !dependencyChain.has(currentId)) {
          dependencyChain.add(currentId);
          const deps = await ctx.db.query.funcDependencies.findMany({
            where: eq(funcDependencies.funcId, currentId),
            columns: {
              dependencyFuncId: true,
            },
          });
          queue.push(...deps.map((d) => d.dependencyFuncId));
        }
      }

      // Get all functions except those that would create cycles
      const availableFunctions = await ctx.db.query.funcs.findMany({
        where: eq(funcs.userId, ctx.session.user.id),
        columns: {
          docs: false,
          code: false,
          npmDependencies: false,
        },
      });

      return availableFunctions.filter(
        (f) =>
          f.id !== input.funcId && // Can't depend on itself
          f.name &&
          f.rawDescription &&
          !dependencyChain.has(f.id) && // Can't create cycles
          !existingDeps.some((d) => d.dependencyFuncId === f.id), // Not already a dependency
      );
    }),
  byProjectId: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await ctx.db.query.projects.findFirst({
        where: eq(projects.id, input.id),
        with: {
          funcs: {
            columns: {
              id: true,
            },
          },
        },
      });

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      const projectFuncIds = project.funcs.map((f) => f.id);

      const funcDependencies = await ctx.db.query.funcDependencies.findMany({
        where: (table, { inArray }) => inArray(table.funcId, projectFuncIds),
        with: {
          func: {
            columns: {
              id: true,
              name: true,
            },
          },
          dependencyFunc: {
            columns: {
              id: true,
              name: true,
            },
          },
        },
      });

      return funcDependencies.reduce(
        (acc, dep) => {
          if (
            projectFuncIds.includes(dep.dependencyFunc.id) &&
            projectFuncIds.includes(dep.func.id)
          ) {
            acc.push({
              source: dep.func.id,
              target: dep.dependencyFunc.id,
            });
          }
          return acc;
        },
        [] as { source: string; target: string }[],
      );
    }),
} satisfies TRPCRouterRecord;
