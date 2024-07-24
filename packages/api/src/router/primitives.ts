import { TRPCError } from "@trpc/server";

import {
  createPrimitiveSchema,
  primitives,
  updatePrimitiveSchema,
} from "@integramind/db/schema";
import type { PrimitiveMetadata } from "@integramind/db/types";

import { type SQL, and, eq, sql } from "@integramind/db";
import { z } from "zod";
import { protectedProcedure } from "../trpc";

export const primitivesRouter = {
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db.query.primitives.findFirst({
        where: eq(primitives.id, input.id),
      });

      if (!result) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Primitive not found",
        });
      }

      return result;
    }),
  getByIdAndType: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        type: z.enum(["function", "route", "workflow"]),
      }),
    )
    .query(async ({ ctx, input }) => {
      const result = await ctx.db.query.primitives.findFirst({
        where: and(
          eq(primitives.id, input.id),
          eq(primitives.type, input.type),
        ),
      });

      if (!result || result.metadata.type !== input.type) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Primitive not found",
        });
      }

      return result;
    }),
  create: protectedProcedure
    .input(createPrimitiveSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .insert(primitives)
        .values({
          name: input.name,
          type: input.type,
          flowId: input.flowId,
          positionX: input.positionX,
          positionY: input.positionY,
          metadata: input.metadata as PrimitiveMetadata,
        })
        .returning({
          id: primitives.id,
          type: primitives.type,
          name: primitives.name,
          positionX: primitives.positionX,
          positionY: primitives.positionY,
        });

      if (!result[0]) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create primitive",
        });
      }

      return result[0];
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(primitives).where(eq(primitives.id, input.id));
    }),
  update: protectedProcedure
    .input(updatePrimitiveSchema)
    .mutation(async ({ ctx, input }) => {
      const where: SQL[] = [eq(primitives.id, input.where.id)];

      if (input.where.type) {
        where.push(eq(primitives.type, input.where.type));
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

      // TODO: use raw sql to update the metadata
      const updatedPrimitive = await ctx.db
        .update(primitives)
        .set({
          name: input.payload.name,
          description: input.payload.description,
          positionX: input.payload.positionX,
          positionY: input.payload.positionY,
          metadata: sql`${{
            ...savedPrimitive.metadata,
            ...input.payload.metadata,
          }}::jsonb`,
        })
        .where(eq(primitives.id, savedPrimitive.id))
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
