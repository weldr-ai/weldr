import { TRPCError } from "@trpc/server";

import { createPrimitiveSchema, primitives } from "@integramind/db/schema";
import type { PrimitiveMetadata } from "@integramind/db/types";

import { protectedProcedure } from "../trpc";

export const primitivesRouter = {
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
};
