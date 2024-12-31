import { TRPCError, type TRPCRouterRecord } from "@trpc/server";

import { conversations, funcs, testRuns } from "@integramind/db/schema";

import { and, eq } from "@integramind/db";
import {
  insertFuncSchema,
  updateFuncSchema,
} from "@integramind/shared/validators/funcs";
import { z } from "zod";
import { protectedProcedure } from "../trpc";
import { isFunctionReady } from "../utils";

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
              .returning()
          )[0];

          if (!conversation) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create conversation",
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

          return {
            ...result[0],
            conversationId: conversation.id,
          };
        });

        const { code, docs, packages, ...rest } = result;
        return {
          ...rest,
          testRuns: [],
        };
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
  byId: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const result = await ctx.db.query.funcs.findFirst({
        where: and(
          eq(funcs.id, input.id),
          eq(funcs.userId, ctx.session.user.id),
        ),
        columns: {
          docs: false,
          packages: false,
          code: false,
        },
        with: {
          testRuns: true,
          conversation: {
            with: {
              messages: {
                columns: {
                  content: false,
                },
              },
            },
          },
        },
      });

      if (!result) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Function not found",
        });
      }

      return {
        ...result,
        canRun: await isFunctionReady({ id: result.id }),
      };
    }),
  update: protectedProcedure
    .input(updateFuncSchema)
    .mutation(async ({ ctx, input }) => {
      const existingFunc = await ctx.db.query.funcs.findFirst({
        where: and(
          eq(funcs.id, input.where.id),
          eq(funcs.userId, ctx.session.user.id),
        ),
      });

      if (!existingFunc || !existingFunc.conversationId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Function not found",
        });
      }

      if (input.payload.name && existingFunc.projectId) {
        let isUnique = false;

        isUnique =
          (await ctx.db.query.funcs.findFirst({
            where: and(
              eq(funcs.name, input.payload.name),
              eq(funcs.projectId, existingFunc.projectId),
            ),
          })) !== undefined;

        if (isUnique && existingFunc.id !== input.where.id) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Function name already exists in this project",
          });
        }
      }

      const updatedFunc = (
        await ctx.db
          .update(funcs)
          .set(input.payload)
          .where(
            and(
              eq(funcs.id, existingFunc.id),
              eq(funcs.userId, ctx.session.user.id),
            ),
          )
          .returning()
      )[0];

      if (!updatedFunc) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update function",
        });
      }

      const { code, docs, packages, ...rest } = updatedFunc;
      return {
        ...rest,
        canRun: await isFunctionReady({ id: updatedFunc.id }),
      };
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
  byProjectId: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db.query.funcs.findMany({
        where: eq(funcs.projectId, input.projectId),
        columns: {
          code: false,
          docs: false,
          packages: false,
        },
      });

      return result.filter((func) => Boolean(func.name && func.rawDescription));
    }),
} satisfies TRPCRouterRecord;
