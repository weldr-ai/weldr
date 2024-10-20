import { TRPCError } from "@trpc/server";

import { primitives } from "@specly/db/schema";

import { type SQL, and, eq, sql } from "@specly/db";
import { mergeJson } from "@specly/db/utils";
import type {
  InputSchema,
  IteratorPrimitive,
  Primitive,
} from "@specly/shared/types";
import {
  insertPrimitiveSchema,
  iteratorPrimitiveSchema,
  primitiveSchema,
  updatePrimitiveSchema,
} from "@specly/shared/validators/primitives";
import { conversations } from "node_modules/@specly/db/src/schema/conversations";
import { z } from "zod";
import { protectedProcedure } from "../trpc";

export const primitivesRouter = {
  create: protectedProcedure
    .input(insertPrimitiveSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await ctx.db.transaction(async (tx) => {
          const conversation = (
            await tx
              .insert(conversations)
              .values({
                createdBy: ctx.session.user.id,
              })
              .returning({ id: conversations.id })
          )[0];

          if (!conversation) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create conversation",
            });
          }

          const result = await tx
            .insert(primitives)
            .values({
              ...input,
              metadata: sql`${input.metadata}::jsonb`,
              conversationId: conversation.id,
              createdBy: ctx.session.user.id,
            })
            .returning({
              id: primitives.id,
              type: primitives.type,
              name: primitives.name,
              description: primitives.description,
              positionX: primitives.positionX,
              positionY: primitives.positionY,
              metadata: primitives.metadata,
              createdBy: primitives.createdBy,
              createdAt: primitives.createdAt,
              updatedAt: primitives.updatedAt,
              flowId: primitives.flowId,
              parentId: primitives.parentId,
            });

          if (!result[0]) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create primitive",
            });
          }

          return result[0];
        });

        return result;
      } catch (error) {
        console.error(error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create primitive",
        });
      }
    }),
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db.query.primitives.findFirst({
        where: and(
          eq(primitives.id, input.id),
          eq(primitives.createdBy, ctx.session.user.id),
        ),
        with: {
          flow: {
            columns: {
              id: true,
              inputSchema: true,
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
          message: "Primitive not found",
        });
      }

      return result as Primitive & {
        flow: { inputSchema: InputSchema | undefined };
      };
    }),
  getIteratorById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .output(
      iteratorPrimitiveSchema.extend({
        children: primitiveSchema.array(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const result = await ctx.db.query.primitives.findFirst({
        where: and(
          eq(primitives.id, input.id),
          eq(primitives.createdBy, ctx.session.user.id),
          eq(primitives.type, "iterator"),
        ),
        with: {
          conversation: true,
        },
      });

      if (!result) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Primitive not found",
        });
      }

      const children = await ctx.db.query.primitives.findMany({
        where: eq(primitives.parentId, input.id),
        with: {
          conversation: true,
        },
      });

      return {
        ...result,
        children,
      } as unknown as IteratorPrimitive & { children: Primitive[] };
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(primitives)
        .where(
          and(
            eq(primitives.id, input.id),
            eq(primitives.createdBy, ctx.session.user.id),
          ),
        );
    }),
  update: protectedProcedure
    .input(updatePrimitiveSchema)
    .mutation(async ({ ctx, input }) => {
      const where: SQL[] = [
        eq(primitives.id, input.where.id),
        eq(primitives.createdBy, ctx.session.user.id),
      ];

      const existingPrimitive = await ctx.db.query.primitives.findFirst({
        where: and(...where),
      });

      if (!existingPrimitive) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Primitive not found",
        });
      }

      if (input.payload.name) {
        const isUnique = await ctx.db.query.primitives.findFirst({
          where: and(
            eq(primitives.name, input.payload.name),
            eq(primitives.flowId, existingPrimitive.flowId),
          ),
        });

        if (isUnique) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Primitive name already exists in this flow",
          });
        }
      }

      const savedPrimitive = await ctx.db.query.primitives.findFirst({
        where: and(...where),
      });

      if (!savedPrimitive) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Primitive not found",
        });
      }

      if (
        input.payload.parentId &&
        !(
          savedPrimitive.type === "function" ||
          savedPrimitive.type === "matcher"
        )
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Parent ID can only be set for `function` and `matcher` primitives",
        });
      }

      const updatedPrimitive = await ctx.db
        .update(primitives)
        .set({
          ...input.payload,
          metadata: input.payload.metadata
            ? mergeJson(primitives.metadata, input.payload.metadata)
            : undefined,
        })
        .where(
          and(
            eq(primitives.id, savedPrimitive.id),
            eq(primitives.createdBy, ctx.session.user.id),
          ),
        )
        .returning({ id: primitives.id });

      if (!updatedPrimitive[0]) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update primitive",
        });
      }

      return updatedPrimitive[0];
    }),
};
