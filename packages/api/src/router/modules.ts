import { and, db, eq } from "@integramind/db";
import { modules, projects } from "@integramind/db/schema";
import {
  insertModuleSchema,
  updateModuleSchema,
} from "@integramind/shared/validators/modules";
import { TRPCError, type TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure } from "../trpc";

export const modulesRouter = {
  create: protectedProcedure
    .input(insertModuleSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const { projectId, ...rest } = input;

        const project = await db.query.projects.findFirst({
          where: and(
            eq(projects.id, projectId),
            eq(projects.userId, ctx.session.user.id),
          ),
        });

        if (!project) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Project not found",
          });
        }

        const module = (
          await db
            .insert(modules)
            .values({
              ...rest,
              userId: ctx.session.user.id,
              projectId,
            })
            .returning({
              id: modules.id,
            })
        )[0];

        if (!module) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create module",
          });
        }

        return module;
      } catch (error) {
        console.error(error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create module",
        });
      }
    }),
  byId: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const module = await db.query.modules.findFirst({
          where: and(
            eq(modules.id, input.id),
            eq(modules.userId, ctx.session.user.id),
          ),
          with: {
            funcs: {
              with: {
                conversation: {
                  with: {
                    messages: true,
                  },
                },
                internalGraph: true,
                testRuns: true,
              },
            },
          },
        });

        if (!module) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Module not found",
          });
        }

        const moduleFuncIds = module.funcs.map((f) => f.id);

        const funcDependencies = await ctx.db.query.funcDependencies.findMany({
          where: (table, { inArray }) => inArray(table.funcId, moduleFuncIds),
          with: {
            func: true,
            dependencyFunc: true,
          },
        });

        const edges = funcDependencies.reduce(
          (acc, dep) => {
            if (
              moduleFuncIds.includes(dep.dependencyFunc.id) &&
              moduleFuncIds.includes(dep.func.id)
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

        return {
          ...module,
          funcs: module.funcs.map((func) => ({
            ...func,
            canRun: Boolean(func.name && func.description && func.code),
          })),
          edges,
        };
      } catch (error) {
        console.error(error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get module",
        });
      }
    }),
  list: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const modulesResult = await db.query.modules.findMany({
          where: and(
            eq(modules.userId, ctx.session.user.id),
            eq(modules.projectId, input.projectId),
          ),
        });
        return modulesResult;
      } catch (error) {
        console.error(error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get modules",
        });
      }
    }),
  update: protectedProcedure
    .input(updateModuleSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const { where, payload } = input;

        const module = await db.query.modules.findFirst({
          where: and(
            eq(modules.id, where.id),
            eq(modules.userId, ctx.session.user.id),
          ),
        });

        if (!module) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Module not found",
          });
        }

        const updatedModule = (
          await db
            .update(modules)
            .set(payload)
            .where(and(eq(modules.id, where.id)))
            .returning({
              id: modules.id,
            })
        )[0];

        if (!updatedModule) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to update module",
          });
        }

        return updatedModule;
      } catch (error) {
        console.error(error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update module",
        });
      }
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const { id } = input;

        const module = await db.query.modules.findFirst({
          where: and(
            eq(modules.id, id),
            eq(modules.userId, ctx.session.user.id),
          ),
        });

        if (!module) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Module not found",
          });
        }

        await db.delete(modules).where(eq(modules.id, id));
      } catch (error) {
        console.error(error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete module",
        });
      }
    }),
} satisfies TRPCRouterRecord;
