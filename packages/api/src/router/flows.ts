import { and, eq, inArray } from "@integramind/db";
import { conversations, flows, funcs } from "@integramind/db/schema";
import type { Flow, Func, InputSchema } from "@integramind/shared/types";
import {
  insertFlowSchema,
  updateFlowSchema,
} from "@integramind/shared/validators/flows";
import { TRPCError, type TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure } from "../trpc";
import { canRunFlow, canRunFunc } from "../utils";

export const flowsRouter = {
  create: protectedProcedure
    .input(insertFlowSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await ctx.db.transaction(async (tx) => {
          const inputConversation = (
            await tx
              .insert(conversations)
              .values({
                userId: ctx.session.user.id,
              })
              .returning({ id: conversations.id })
          )[0];

          if (!inputConversation) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create conversation",
            });
          }

          const outputConversation = (
            await tx
              .insert(conversations)
              .values({
                userId: ctx.session.user.id,
              })
              .returning({ id: conversations.id })
          )[0];

          if (!outputConversation) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create output conversation",
            });
          }

          const result = await tx
            .insert(flows)
            .values({
              name: input.name,
              workspaceId: input.workspaceId,
              userId: ctx.session.user.id,
              inputConversationId: inputConversation.id,
              outputConversationId: outputConversation.id,
            })
            .returning({ id: flows.id });

          if (!result[0]) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create flow",
            });
          }

          return result[0];
        });

        return result;
      } catch (error) {
        console.error(error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create flow",
        });
      }
    }),
  list: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      return await ctx.db.query.flows.findMany({
        where: and(
          eq(flows.workspaceId, input.workspaceId),
          eq(flows.userId, ctx.session.user.id),
        ),
      });
    }),
  byIds: protectedProcedure
    .input(z.object({ ids: z.string().array() }))
    .query(async ({ ctx, input }) => {
      return await ctx.db.query.flows.findMany({
        where: and(
          eq(flows.userId, ctx.session.user.id),
          inArray(flows.id, input.ids),
        ),
      });
    }),
  byId: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db.query.flows.findFirst({
        where: and(
          eq(flows.id, input.id),
          eq(flows.userId, ctx.session.user.id),
        ),
        with: {
          funcs: true,
          inputConversation: {
            with: {
              messages: true,
            },
          },
          outputConversation: {
            with: {
              messages: true,
            },
          },
        },
      });

      if (!result) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Flow not found",
        });
      }

      return {
        ...result,
        canRun: canRunFlow(result as unknown as Flow & { funcs: Func[] }),
      } as Flow & { canRun: boolean };
    }),
  byIdWithFuncs: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db.query.flows.findFirst({
        where: and(
          eq(flows.id, input.id),
          eq(flows.userId, ctx.session.user.id),
        ),
        with: {
          funcs: true,
        },
      });

      if (!result) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Flow not found",
        });
      }

      return {
        ...result,
        canRun: canRunFlow(result as Flow & { funcs: Func[] }),
      };
    }),
  byIdWithAssociatedData: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db.query.flows.findFirst({
        where: and(
          eq(flows.id, input.id),
          eq(flows.userId, ctx.session.user.id),
        ),
        with: {
          funcs: {
            with: {
              conversation: {
                with: {
                  messages: true,
                },
              },
              testRuns: true,
            },
          },
          inputConversation: {
            with: {
              messages: true,
            },
          },
          outputConversation: {
            with: {
              messages: true,
            },
          },
        },
      });

      if (!result) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Flow not found",
        });
      }

      return {
        ...result,
        canRun: canRunFlow(result as Flow & { funcs: Func[] }),
        funcs: result.funcs.map((func) => ({
          ...func,
          canRun: canRunFunc(func as Func),
          flow: {
            inputSchema: result.inputSchema,
          },
        })),
      } as Flow & {
        funcs: (Func & {
          flow: { inputSchema: InputSchema };
        })[];
      };
    }),
  funcs: protectedProcedure
    .input(z.object({ flowId: z.string() }))
    .query(async ({ ctx, input }) => {
      return await ctx.db.query.funcs.findMany({
        where: and(
          eq(funcs.flowId, input.flowId),
          eq(funcs.userId, ctx.session.user.id),
        ),
      });
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const flow = await ctx.db.query.flows.findFirst({
        where: and(
          eq(flows.id, input.id),
          eq(flows.userId, ctx.session.user.id),
        ),
      });

      if (!flow) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Flow not found",
        });
      }

      await ctx.db
        .delete(conversations)
        .where(eq(conversations.id, flow.inputConversationId));

      await ctx.db
        .delete(conversations)
        .where(eq(conversations.id, flow.outputConversationId));

      await ctx.db
        .delete(flows)
        .where(
          and(eq(flows.id, flow.id), eq(flows.userId, ctx.session.user.id)),
        );
    }),
  update: protectedProcedure
    .input(updateFlowSchema)
    .mutation(async ({ ctx, input }) => {
      const savedFlow = await ctx.db.query.flows.findFirst({
        where: and(
          eq(flows.id, input.where.id),
          eq(flows.userId, ctx.session.user.id),
        ),
      });

      if (!savedFlow) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Flow not found",
        });
      }

      await ctx.db
        .update(flows)
        .set(input.payload)
        .where(
          and(
            eq(flows.id, input.where.id),
            eq(flows.userId, ctx.session.user.id),
          ),
        );
    }),
} satisfies TRPCRouterRecord;
