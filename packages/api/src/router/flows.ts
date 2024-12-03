import { and, eq, inArray, sql } from "@integramind/db";
import { conversations, flows } from "@integramind/db/schema";
import { mergeJson } from "@integramind/db/utils";
import type { Conversation, Flow, Primitive } from "@integramind/shared/types";
import {
  flowTypesSchema,
  insertFlowSchema,
  updateFlowSchema,
} from "@integramind/shared/validators/flows";
import { TRPCError, type TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure } from "../trpc";

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

          const values = {
            name: input.name,
            description: input.description,
            type: input.type,
            metadata: sql`${{}}::jsonb`,
            workspaceId: input.workspaceId,
            userId: ctx.session.user.id,
            conversationId: conversation.id,
          };

          if (input.type === "endpoint" || input.type === "task") {
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
          eq(flows.type, "utilities"),
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
          conversation: {
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

      return result as Flow;
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

      return result;
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
          conversation: {
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

      return result as Flow & {
        primitives: Primitive[];
        conversation: Conversation;
      };
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(flows)
        .where(
          and(eq(flows.id, input.id), eq(flows.userId, ctx.session.user.id)),
        );
    }),
  update: protectedProcedure
    .input(updateFlowSchema)
    .mutation(async ({ ctx, input }) => {
      const savedPrimitive = await ctx.db.query.flows.findFirst({
        where: and(
          eq(flows.id, input.where.id),
          eq(flows.userId, ctx.session.user.id),
        ),
      });

      if (!savedPrimitive) {
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
