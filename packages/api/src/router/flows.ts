import { and, eq, sql } from "@integramind/db";
import { flows, primitives } from "@integramind/db/schema";
import { mergeJson } from "@integramind/db/utils";
import type { Flow, StopPrimitive } from "@integramind/shared/types";
import {
  flowTypesSchema,
  insertFlowSchema,
  updateFlowSchema,
} from "@integramind/shared/validators/flows";
import { TRPCError, type TRPCRouterRecord } from "@trpc/server";
import { conversations } from "node_modules/@integramind/db/src/schema/conversations";
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
          const inputConversation = (
            await tx
              .insert(conversations)
              .values({
                createdBy: ctx.session.user.id,
              })
              .returning({ id: conversations.id })
          )[0];

          const outputConversation = (
            await tx
              .insert(conversations)
              .values({
                createdBy: ctx.session.user.id,
              })
              .returning({ id: conversations.id })
          )[0];

          if (!inputConversation || !outputConversation) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create flow",
            });
          }

          const values = {
            name: input.name,
            description: input.description,
            type: input.type,
            metadata: sql`${{}}::jsonb`,
            workspaceId: input.workspaceId,
            createdBy: ctx.session.user.id,
            inputConversationId: inputConversation.id,
            outputConversationId: outputConversation.id,
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

          await tx.insert(primitives).values({
            type: "stop",
            flowId: result[0].id,
            createdBy: ctx.session.user.id,
          });

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
  getAll: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      return await ctx.db.query.flows.findMany({
        where: and(
          eq(flows.workspaceId, input.workspaceId),
          eq(flows.createdBy, ctx.session.user.id),
        ),
      });
    }),
  getAllByType: protectedProcedure
    .input(z.object({ workspaceId: z.string(), type: flowTypesSchema }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db.query.flows.findMany({
        where: and(
          eq(flows.workspaceId, input.workspaceId),
          eq(flows.type, input.type),
          eq(flows.createdBy, ctx.session.user.id),
        ),
      });
      return result;
    }),
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db.query.flows.findFirst({
        where: and(
          eq(flows.id, input.id),
          eq(flows.createdBy, ctx.session.user.id),
        ),
        with: {
          primitives: {
            where: eq(primitives.type, "stop"),
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
        stopNode: result.primitives[0] as StopPrimitive,
      } as Flow;
    }),
  getByIdWithAssociatedData: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db.query.flows.findFirst({
        where: and(
          eq(flows.id, input.id),
          eq(flows.createdBy, ctx.session.user.id),
        ),
        with: {
          primitives: {
            with: {
              conversation: {
                with: {
                  messages: true,
                },
              },
            },
          },
          edges: true,
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

      return result;
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(flows)
        .where(
          and(eq(flows.id, input.id), eq(flows.createdBy, ctx.session.user.id)),
        );
    }),
  update: protectedProcedure
    .input(updateFlowSchema)
    .mutation(async ({ ctx, input }) => {
      const savedPrimitive = await ctx.db.query.flows.findFirst({
        where: and(
          eq(flows.id, input.where.id),
          eq(flows.createdBy, ctx.session.user.id),
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
            eq(flows.createdBy, ctx.session.user.id),
          ),
        );
    }),
  getEndpointFlowByPath: protectedProcedure
    .input(
      z.object({
        path: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const flow = await ctx.db.query.flows.findFirst({
        where: sql`metadata::jsonb->>'path' = ${input.path}`,
        with: {
          primitives: true,
          edges: true,
        },
      });

      if (!flow) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Flow not found",
        });
      }

      return flow;
    }),
} satisfies TRPCRouterRecord;
