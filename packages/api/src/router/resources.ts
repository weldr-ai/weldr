import { and, eq } from "@specly/db";
import { resources } from "@specly/db/schema";
import { insertResourceSchema } from "@specly/shared/validators/resources";
import { TRPCError, type TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure } from "../trpc";

export const resourcesRouter = {
  create: protectedProcedure
    .input(insertResourceSchema)
    .mutation(async ({ ctx, input }) => {
      const doesExist = await ctx.db.query.resources.findFirst({
        where: and(
          eq(resources.name, input.name),
          eq(resources.workspaceId, input.workspaceId),
        ),
      });

      if (doesExist) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Resource name must be unique",
        });
      }

      const result = await ctx.db
        .insert(resources)
        .values({
          name: input.name,
          description: input.description,
          workspaceId: input.workspaceId,
          createdBy: ctx.session.user.id,
          integrationId: input.integrationId,
        })
        .returning({ id: resources.id });

      if (!result[0]) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create resource",
        });
      }

      return result[0];
    }),
  getAll: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      return await ctx.db.query.resources.findMany({
        where: and(
          eq(resources.workspaceId, input.workspaceId),
          eq(resources.createdBy, ctx.session.user.id),
        ),
        with: {
          integration: {
            columns: {
              type: true,
            },
          },
        },
      });
    }),
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db.query.resources.findFirst({
        where: and(
          eq(resources.id, input.id),
          eq(resources.createdBy, ctx.session.user.id),
        ),
        with: {
          integration: {
            columns: {
              type: true,
            },
          },
        },
      });

      if (!result) {
        throw new Error("Resource not found");
      }

      return result;
    }),
} satisfies TRPCRouterRecord;
