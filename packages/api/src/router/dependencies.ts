import { eq } from "@integramind/db";
import { dependencies, funcs, projects } from "@integramind/db/schema";
import { insertDependencySchema } from "@integramind/shared/validators/dependencies";
import { TRPCError, type TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure } from "../trpc";
import { wouldCreateCycle } from "../utils";

export const dependenciesRouter = {
  create: protectedProcedure
    .input(insertDependencySchema)
    .mutation(async ({ ctx, input }) => {
      if (
        input.dependentType === "function" &&
        (await wouldCreateCycle({
          dependentId: input.dependentId,
          dependencyId: input.dependencyId,
        }))
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "The provided dependencies will cause a circular dependency",
        });
      }
      await ctx.db.insert(dependencies).values(input).onConflictDoNothing();
    }),
  createBulk: protectedProcedure
    .input(
      z.object({
        dependentType: z.enum(["function", "endpoint"]),
        dependentId: z.string(),
        dependencyIds: z.array(z.string()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.dependentType === "function") {
        for (const dep of input.dependencyIds) {
          const isCyclic = await wouldCreateCycle({
            dependentId: input.dependentId,
            dependencyId: dep,
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
          input.dependencyIds.map((dep) => ({
            dependentType: input.dependentType,
            dependentId: input.dependentId,
            dependencyId: dep,
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
        where: (table, { and, eq }) =>
          and(
            eq(table.dependentId, input.dependentId),
            eq(table.dependentType, input.dependentType),
          ),
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
        },
      });

      return availableFunctions.filter((f) => {
        // Basic validation
        if (!f.name || !f.rawDescription) return false;

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
          endpoints: {
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
      const projectEndpointIds = project.endpoints.map((e) => e.id);

      const allDependencies = await ctx.db.query.dependencies.findMany({
        where: (table, { or, and, inArray }) =>
          or(
            and(
              eq(table.dependentType, "function"),
              inArray(table.dependentId, projectFuncIds),
            ),
            and(
              eq(table.dependentType, "endpoint"),
              inArray(table.dependentId, projectEndpointIds),
            ),
          ),
        with: {
          dependentFunc: {
            columns: {
              id: true,
              name: true,
            },
          },
          dependentEndpoint: {
            columns: {
              id: true,
              path: true,
              method: true,
            },
          },
          dependency: {
            columns: {
              id: true,
              name: true,
            },
          },
        },
      });

      return allDependencies.map((dep) => ({
        source: dep.dependency.id,
        target: dep.dependentId,
        targetType: dep.dependentType,
      }));
    }),
} satisfies TRPCRouterRecord;
