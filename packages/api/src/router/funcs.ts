import { TRPCError, type TRPCRouterRecord } from "@trpc/server";

import { conversations, funcs } from "@integramind/db/schema";

import { and, eq, isNull } from "@integramind/db";
import {
  createNewFuncVersionSchema,
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

          const newFunc = (
            await tx
              .insert(funcs)
              .values({
                ...input,
                userId: ctx.session.user.id,
                conversationId: conversation?.id,
              })
              .returning()
          )[0];

          if (!newFunc) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create function",
            });
          }

          return {
            ...newFunc,
            conversationId: conversation.id,
            conversation: {
              ...conversation,
              messages: [],
            },
          };
        });

        const { integrationId, code, packages, docs, resources, ...rest } =
          result;
        return {
          ...rest,
          canRun: await isFunctionReady(result),
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
      try {
        const result = await ctx.db.query.funcs.findFirst({
          where: and(
            eq(funcs.id, input.id),
            eq(funcs.userId, ctx.session.user.id),
            isNull(funcs.deletedAt),
          ),
          with: {
            conversation: {
              with: {
                messages: {
                  columns: {
                    id: true,
                    role: true,
                    rawContent: true,
                    createdAt: true,
                  },
                  orderBy: (funcsMessages, { asc }) => [
                    asc(funcsMessages.createdAt),
                  ],
                  with: {
                    version: {
                      columns: {
                        id: true,
                        versionName: true,
                        versionNumber: true,
                      },
                    },
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

        const {
          code,
          packages,
          docs,
          resources,
          deletedAt,
          integrationId,
          ...rest
        } = result;

        return {
          ...rest,
          canRun: await isFunctionReady(result),
        };
      } catch (error) {
        console.error(error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get function",
        });
      }
    }),
  update: protectedProcedure
    .input(updateFuncSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const func = await ctx.db.query.funcs.findFirst({
          where: and(
            eq(funcs.id, input.where.id),
            eq(funcs.userId, ctx.session.user.id),
          ),
        });

        if (!func) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Function not found",
          });
        }

        const updatedFunc = (
          await ctx.db
            .update(funcs)
            .set(input.payload)
            .where(eq(funcs.id, func.id))
            .returning()
        )[0];

        if (!updatedFunc) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to update function",
          });
        }

        const { integrationId, ...updatedFuncRest } = updatedFunc;

        return {
          ...updatedFuncRest,
          canRun: await isFunctionReady(updatedFunc),
        };
      } catch (error) {
        console.error(error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update function",
        });
      }
    }),
  createNewVersion: protectedProcedure
    .input(createNewFuncVersionSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const func = await ctx.db.query.funcs.findFirst({
          where: and(
            eq(funcs.id, input.where.id),
            eq(funcs.userId, ctx.session.user.id),
          ),
        });

        if (!func) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Function not found",
          });
        }

        if (!func.code) {
          await ctx.db
            .update(funcs)
            .set(input.payload)
            .where(eq(funcs.id, func.id));
          return;
        }

        await ctx.db.insert(funcs).values({
          ...func,
          ...input.payload,
        });
      } catch (error) {
        console.error(error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create new function version",
        });
      }
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db.transaction(async (tx) => {
          const func = await ctx.db.query.funcs.findFirst({
            where: and(
              eq(funcs.id, input.id),
              eq(funcs.userId, ctx.session.user.id),
              isNull(funcs.deletedAt),
            ),
          });

          if (!func || !func.conversationId) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Function not found",
            });
          }

          await tx
            .update(funcs)
            .set({
              deletedAt: new Date(),
            })
            .where(
              and(
                eq(funcs.id, func.id),
                eq(funcs.userId, ctx.session.user.id),
                isNull(funcs.deletedAt),
              ),
            );
        });
      } catch (error) {
        console.error(error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete function",
        });
      }
    }),
} satisfies TRPCRouterRecord;
