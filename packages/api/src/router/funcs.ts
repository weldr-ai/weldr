import { TRPCError, type TRPCRouterRecord } from "@trpc/server";

import { conversations, flows, funcs, testRuns } from "@integramind/db/schema";

import { type SQL, and, eq, inArray } from "@integramind/db";
import type { Func } from "@integramind/shared/types";
import {
  insertFuncSchema,
  updateFuncSchema,
} from "@integramind/shared/validators/funcs";
import { z } from "zod";
import { protectedProcedure } from "../trpc";
import { canRunFunc } from "../utils";

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

          const flow = await tx.query.flows.findFirst({
            where: eq(flows.id, input.flowId),
          });

          if (!flow) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Flow not found",
            });
          }

          if (!flow.inputSchema) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Cannot create function in flow without input schema",
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
        canRun: canRunFunc(func as Func),
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
        canRun: canRunFunc(result as Func),
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

      if (!existingFunc) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Function not found",
        });
      }

      if (input.payload.name) {
        let isUnique = false;

        if (existingFunc.flowId) {
          isUnique =
            (await ctx.db.query.funcs.findFirst({
              where: and(
                eq(funcs.name, input.payload.name),
                eq(funcs.flowId, existingFunc.flowId),
              ),
            })) !== undefined;
        }

        if (isUnique) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Function name already exists in this flow",
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

      if (!func) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Function not found",
        });
      }

      await ctx.db
        .delete(conversations)
        .where(eq(conversations.id, func.conversationId));

      await ctx.db
        .delete(funcs)
        .where(
          and(eq(funcs.id, func.id), eq(funcs.userId, ctx.session.user.id)),
        );
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
} satisfies TRPCRouterRecord;
