import { TRPCError } from "@trpc/server";

import { chatMessages, primitives } from "@specly/db/schema";
import type { IteratorPrimitive, Primitive } from "@specly/shared/types";

import { type SQL, and, eq, notInArray, sql } from "@specly/db";
import {
  insertPrimitiveSchema,
  iteratorPrimitiveSchema,
  primitiveSchema,
  rawDescriptionSchema,
  updatePrimitiveSchema,
} from "@specly/shared/validators/primitives";
import { z } from "zod";
import { protectedProcedure } from "../trpc";

export const primitivesRouter = {
  create: protectedProcedure
    .input(insertPrimitiveSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .insert(primitives)
        .values({
          ...input,
          metadata: sql`${input.metadata}::jsonb`,
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
          chatMessages: true,
        },
      });

      if (!result) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Primitive not found",
        });
      }

      return result as Primitive;
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
      });

      if (!result) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Primitive not found",
        });
      }

      const children = await ctx.db.query.primitives.findMany({
        where: eq(primitives.parentId, input.id),
      });

      return {
        ...(result as IteratorPrimitive),
        children: children as Primitive[],
      } as IteratorPrimitive & { children: Primitive[] };
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(primitives)
        .where(
          and(
            eq(primitives.id, input.id),
            notInArray(primitives.type, ["route", "workflow"]),
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

      // TODO: use raw sql to update the metadata
      const updatedPrimitive = await ctx.db
        .update(primitives)
        .set({
          ...input.payload,
          metadata: sql`${{
            ...savedPrimitive.metadata,
            ...input.payload.metadata,
          }}::jsonb`,
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

      console.log(updatedPrimitive[0]);

      return updatedPrimitive[0];
    }),
  addMessage: protectedProcedure
    .input(
      z.object({
        message: z.string(),
        rawMessage: rawDescriptionSchema.array().optional(),
        role: z.enum(["user", "assistant"]),
        primitiveId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .insert(chatMessages)
        .values({
          message: input.message,
          rawMessage: input.rawMessage,
          role: input.role,
          primitiveId: input.primitiveId,
        })
        .returning({ id: chatMessages.id });

      if (!result[0]) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to add message",
        });
      }

      return true;
    }),
};
