import { TRPCError } from "@trpc/server";

import { primitives } from "@integramind/db/schema";
import type {
  Input,
  IteratorPrimitive,
  Primitive,
  RoutePrimitive,
} from "@integramind/shared/types";

import { type SQL, and, eq, notInArray, sql } from "@integramind/db";
import {
  insertPrimitiveSchema,
  iteratorPrimitiveSchema,
  primitiveSchema,
  updatePrimitiveSchema,
} from "@integramind/shared/validators/primitives";
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
      if (input.payload.name) {
        const isUnique = await ctx.db.query.primitives.findFirst({
          where: and(
            eq(primitives.name, input.payload.name),
            eq(primitives.flowId, input.where.flowId),
            eq(primitives.createdBy, ctx.session.user.id),
          ),
        });

        if (isUnique) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Primitive name already exists",
          });
        }
      }

      const where: SQL[] = [
        eq(primitives.id, input.where.id),
        eq(primitives.createdBy, ctx.session.user.id),
      ];

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
          name: input.payload.name,
          description: input.payload.description,
          positionX: input.payload.positionX,
          positionY: input.payload.positionY,
          parentId: input.payload.parentId,
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

      const result = (await ctx.db.query.primitives.findFirst({
        where: and(
          eq(primitives.id, input.id),
          eq(primitives.type, "route"),
          eq(primitives.createdBy, ctx.session.user.id),
        ),
      })) as RoutePrimitive;

      if (!result) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Primitive not found",
        });
      }

      const updatedInputs = updateInputById(
        result.metadata.inputs ?? [],
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
      const result = (await ctx.db.query.primitives.findFirst({
        where: and(
          eq(primitives.id, input.id),
          eq(primitives.type, "route"),
          eq(primitives.createdBy, ctx.session.user.id),
        ),
      })) as RoutePrimitive;

      if (!result) {
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
