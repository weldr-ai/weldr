import { TRPCError, type TRPCRouterRecord } from "@trpc/server";

import { primitives, testRuns } from "@integramind/db/schema";

import { type SQL, and, eq } from "@integramind/db";
import { conversations } from "@integramind/db/schema";
import { mergeJson } from "@integramind/db/utils";
import type { InputSchema, Primitive } from "@integramind/shared/types";
import {
  insertPrimitiveSchema,
  updatePrimitiveSchema,
} from "@integramind/shared/validators/primitives";
import { z } from "zod";
import { protectedProcedure } from "../trpc";

export const primitivesRouter = {
  create: protectedProcedure
    .input(insertPrimitiveSchema)
    .mutation(async ({ ctx, input }) => {
      if (input.type === "stop") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Stop primitive cannot be created",
        });
      }

      try {
        const result = await ctx.db.transaction(async (tx) => {
          let conversation: { id: string } | undefined;
          if (input.type === "function") {
            conversation = (
              await tx
                .insert(conversations)
                .values({
                  createdBy: ctx.session.user.id,
                })
                .returning({ id: conversations.id })
            )[0];
          }

          const result = await tx
            .insert(primitives)
            .values({
              ...input,
              createdBy: ctx.session.user.id,
              conversationId: conversation?.id,
            })
            .returning();

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
  byId: protectedProcedure
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
          testRuns: true,
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

        if (isUnique && isUnique.id !== existingPrimitive.id) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Primitive name already exists in this flow",
          });
        }
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
            eq(primitives.id, existingPrimitive.id),
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
  createTestRun: protectedProcedure
    .input(
      z.object({
        input: z.record(z.string(), z.unknown()).optional(),
        output: z.record(z.string(), z.unknown()).optional(),
        primitiveId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = (
        await ctx.db
          .insert(testRuns)
          .values({
            output: input.output ?? undefined,
            input: input.input ?? undefined,
            primitiveId: input.primitiveId,
          })
          .returning({ id: testRuns.id })
      )[0];

      if (!result) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create test run",
        });
      }

      return result;
    }),
} satisfies TRPCRouterRecord;
