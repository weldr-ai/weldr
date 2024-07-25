import { TRPCError } from "@trpc/server";

import {
  insertPrimitiveSchema,
  primitives,
  updatePrimitiveSchema,
} from "@integramind/db/schema";
import type { Input } from "@integramind/db/types";

import { type SQL, and, eq, sql } from "@integramind/db";
import { z } from "zod";
import { protectedProcedure } from "../trpc";

export const primitivesRouter = {
  create: protectedProcedure
    .input(insertPrimitiveSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .insert(primitives)
        .values({
          name: input.name,
          type: input.type,
          flowId: input.flowId,
          positionX: input.positionX,
          positionY: input.positionY,
          metadata: sql`${input.metadata}::jsonb`,
          createdBy: ctx.session.user.id,
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
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db.query.primitives.findFirst({
        where: and(
          eq(primitives.id, input.id),
          eq(primitives.createdBy, ctx.session.user.id),
        ),
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
          eq(primitives.createdBy, ctx.session.user.id),
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
  updateInput: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        inputId: z.string(),
        name: z.string().optional(),
        testValue: z.union([z.string(), z.number()]).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      function updateInputById(
        inputs: Input[],
        id: string,
        name?: string,
        testValue?: string | number | null,
      ): Input[] {
        return inputs.map((input) =>
          input.id === id
            ? {
                ...input,
                name: name ?? input.name,
                testValue: testValue ?? input.testValue,
              }
            : input,
        );
      }

      const result = await ctx.db.query.primitives.findFirst({
        where: and(
          eq(primitives.id, input.id),
          eq(primitives.createdBy, ctx.session.user.id),
        ),
      });

      if (!result || result.metadata.type !== "route") {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Primitive not found",
        });
      }

      const updatedInputs = updateInputById(
        result.metadata.inputs,
        input.inputId,
        input.name,
        input.testValue,
      );

      await ctx.db
        .update(primitives)
        .set({
          metadata: sql`${{
            ...result.metadata,
            inputs: [...updatedInputs],
          }}::jsonb`,
        })
        .where(
          and(
            eq(primitives.id, input.id),
            eq(primitives.createdBy, ctx.session.user.id),
          ),
        );

      return updatedInputs;
    }),
  addInput: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        inputId: z.string(),
        name: z.string(),
        type: z.enum(["text", "number"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.query.primitives.findFirst({
        where: and(
          eq(primitives.id, input.id),
          eq(primitives.createdBy, ctx.session.user.id),
        ),
      });

      if (!result || result.metadata.type !== "route") {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Primitive not found",
        });
      }

      await ctx.db
        .update(primitives)
        .set({
          metadata: sql`${{
            ...result.metadata,
            inputs: [
              ...(result.metadata.inputs ? result.metadata.inputs : []),
              { id: input.inputId, name: input.name, type: input.type },
            ],
          }}::jsonb`,
        })
        .where(
          and(
            eq(primitives.id, input.id),
            eq(primitives.createdBy, ctx.session.user.id),
          ),
        );
    }),
};
