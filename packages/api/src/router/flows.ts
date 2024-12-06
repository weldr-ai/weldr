import { and, eq, inArray, sql } from "@integramind/db";
import { conversations, flows, primitives } from "@integramind/db/schema";
import { mergeJson } from "@integramind/db/utils";
import type {
  Flow,
  FlowType,
  InputSchema,
  Primitive,
} from "@integramind/shared/types";
import {
  flowTypesSchema,
  insertFlowSchema,
  updateFlowSchema,
} from "@integramind/shared/validators/flows";
import { TRPCError, type TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure } from "../trpc";
import { canRunFlow, canRunPrimitive } from "../utils";

export const flowsRouter = {
  create: protectedProcedure
    .input(insertFlowSchema)
    .mutation(async ({ ctx, input }) => {
      if (input.type === "endpoint") {
        const flow = await ctx.db.query.flows.findFirst({
          where: sql`metadata::jsonb->>'path' = ${input.metadata.path}`,
        });

        if (flow) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Endpoint with this path already exists",
          });
        }
      }

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

          const values = {
            name: input.name,
            type: input.type,
            metadata: sql`${{}}::jsonb`,
            workspaceId: input.workspaceId,
            userId: ctx.session.user.id,
            inputConversationId: inputConversation.id,
            outputConversationId: outputConversation.id,
          };

          if (input.type === "endpoint") {
            values.metadata = sql`${{
              ...input.metadata,
              method: "GET",
            }}::jsonb`;
          }

          if (input.type === "workflow") {
            values.metadata = sql`${input.metadata}::jsonb`;
          }

          const result = await tx
            .insert(flows)
            .values(values)
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
  listByType: protectedProcedure
    .input(z.object({ workspaceId: z.string(), type: flowTypesSchema }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db.query.flows.findMany({
        where: and(
          eq(flows.workspaceId, input.workspaceId),
          eq(flows.type, input.type),
          eq(flows.userId, ctx.session.user.id),
        ),
      });
      return result;
    }),
  utilitiesByIds: protectedProcedure
    .input(z.object({ ids: z.string().array() }))
    .query(async ({ ctx, input }) => {
      return await ctx.db.query.flows.findMany({
        where: and(
          eq(flows.type, "utility"),
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
          primitives: true,
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
        canRun: canRunFlow(
          result as unknown as Flow & { primitives: Primitive[] },
        ),
      } as Flow & { canRun: boolean };
    }),
  byIdWithPrimitives: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db.query.flows.findFirst({
        where: and(
          eq(flows.id, input.id),
          eq(flows.userId, ctx.session.user.id),
        ),
        with: {
          primitives: true,
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
        canRun: canRunFlow(result as Flow & { primitives: Primitive[] }),
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
          primitives: {
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
        canRun: canRunFlow(result as Flow & { primitives: Primitive[] }),
        primitives: result.primitives.map((primitive) => ({
          ...primitive,
          canRun: canRunPrimitive(primitive as Primitive),
          flow: {
            inputSchema: result.inputSchema,
            type: result.type,
          },
        })),
      } as Flow & {
        primitives: (Primitive & {
          flow: { inputSchema: InputSchema; type: FlowType };
        })[];
      };
    }),
  primitives: protectedProcedure
    .input(z.object({ flowId: z.string() }))
    .query(async ({ ctx, input }) => {
      return await ctx.db.query.primitives.findMany({
        where: and(
          eq(primitives.flowId, input.flowId),
          eq(primitives.userId, ctx.session.user.id),
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
        .set({
          ...input.payload,
          metadata: input.payload.metadata
            ? mergeJson(flows.metadata, input.payload.metadata)
            : undefined,
        })
        .where(
          and(
            eq(flows.id, input.where.id),
            eq(flows.userId, ctx.session.user.id),
          ),
        );
    }),
} satisfies TRPCRouterRecord;
