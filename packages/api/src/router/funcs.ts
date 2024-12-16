import { TRPCError, type TRPCRouterRecord } from "@trpc/server";

import {
  conversations,
  funcs,
  modules,
  testRuns,
} from "@integramind/db/schema";

import { type SQL, and, eq, inArray } from "@integramind/db";
import type { Func } from "@integramind/shared/types";
import {
  insertFuncSchema,
  updateFuncSchema,
} from "@integramind/shared/validators/funcs";
import { z } from "zod";
import { protectedProcedure } from "../trpc";

export const funcsRouter = {
  create: protectedProcedure
    .input(insertFuncSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await ctx.db.transaction(async (tx) => {
          const conversation = (
            await tx
              .insert(conversations)
              .values({
                userId: ctx.session.user.id,
              })
              .returning({ id: conversations.id })
          )[0];

          if (!conversation) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create conversation",
            });
          }

          const module = await tx.query.modules.findFirst({
            where: eq(modules.id, input.moduleId),
          });

          if (!module) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Module not found",
            });
          }

          const result = await tx
            .insert(funcs)
            .values({
              ...input,
              userId: ctx.session.user.id,
              conversationId: conversation?.id,
            })
            .returning();

          if (!result[0]) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create function",
            });
          }

          return result[0];
        });

        return result;
      } catch (error) {
        console.error(error);
        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create function",
        });
      }
    }),
  byIds: protectedProcedure
    .input(z.object({ ids: z.string().array() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db.query.funcs.findMany({
        where: and(
          eq(funcs.userId, ctx.session.user.id),
          inArray(funcs.id, input.ids),
        ),
      });

      return result.map((func) => ({
        ...func,
        canRun: Boolean(func.name && func.code && func.description),
      })) as Func[];
    }),
  byId: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db.query.funcs.findFirst({
        where: and(
          eq(funcs.id, input.id),
          eq(funcs.userId, ctx.session.user.id),
        ),
      });

      if (!result) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Function not found",
        });
      }

      return {
        ...result,
        canRun: Boolean(result.name && result.code && result.description),
      } as Func;
    }),
  update: protectedProcedure
    .input(updateFuncSchema)
    .mutation(async ({ ctx, input }) => {
      const where: SQL[] = [
        eq(funcs.id, input.where.id),
        eq(funcs.userId, ctx.session.user.id),
      ];

      const existingFunc = await ctx.db.query.funcs.findFirst({
        where: and(...where),
      });

      if (!existingFunc || !existingFunc.conversationId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Function not found",
        });
      }

      if (input.payload.name) {
        let isUnique = false;

        if (existingFunc.moduleId) {
          isUnique =
            (await ctx.db.query.funcs.findFirst({
              where: and(
                eq(funcs.name, input.payload.name),
                eq(funcs.moduleId, existingFunc.moduleId),
              ),
            })) !== undefined;
        }

        if (isUnique && existingFunc.id !== input.where.id) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Function name already exists in this module",
          });
        }
      }

      const updatedFunc = await ctx.db
        .update(funcs)
        .set(input.payload)
        .where(
          and(
            eq(funcs.id, existingFunc.id),
            eq(funcs.userId, ctx.session.user.id),
          ),
        )
        .returning({ id: funcs.id });

      if (!updatedFunc[0]) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update function",
        });
      }

      return updatedFunc[0];
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const func = await ctx.db.query.funcs.findFirst({
        where: and(
          eq(funcs.id, input.id),
          eq(funcs.userId, ctx.session.user.id),
        ),
      });

      if (!func || !func.conversationId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Function not found",
        });
      }

      await ctx.db
        .delete(funcs)
        .where(
          and(eq(funcs.id, func.id), eq(funcs.userId, ctx.session.user.id)),
        );

      await ctx.db
        .delete(conversations)
        .where(eq(conversations.id, func.conversationId));
    }),
  createTestRun: protectedProcedure
    .input(
      z.object({
        input: z.record(z.string(), z.unknown()).optional(),
        output: z.object({ stdout: z.string(), stderr: z.string() }).optional(),
        funcId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = (
        await ctx.db
          .insert(testRuns)
          .values({
            stdout: input.output?.stdout ?? "",
            stderr: input.output?.stderr ?? "",
            input: input.input ?? undefined,
            funcId: input.funcId,
          })
          .returning({ id: testRuns.id })
      )[0];

      if (!result) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create test run",
        });
      }

      return result;
    }),
  byWorkspaceId: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db.query.funcs.findMany({
        where: eq(funcs.workspaceId, input.workspaceId),
        with: {
          module: true,
        },
      });

      return result.filter((func) =>
        Boolean(func.name && func.code && func.description),
      );
    }),
} satisfies TRPCRouterRecord;
