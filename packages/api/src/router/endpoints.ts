import { and, eq } from "@integramind/db";
import { endpoints } from "@integramind/db/schema";
import {
  insertEndpointSchema,
  updateEndpointSchema,
} from "@integramind/shared/validators/endpoints";
import { TRPCError, type TRPCRouterRecord } from "@trpc/server";
import { protectedProcedure } from "src/trpc";
import { z } from "zod";

export const endpointsRouter = {
  create: protectedProcedure
    .input(insertEndpointSchema)
    .mutation(async ({ ctx, input }) => {
      const workspace = await ctx.db.query.workspaces.findFirst({
        where: (workspaces, { eq }) =>
          and(
            eq(workspaces.id, input.workspaceId),
            eq(workspaces.userId, ctx.session.user.id),
          ),
      });

      if (!workspace) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Workspace not found",
        });
      }

      try {
        const result = await ctx.db
          .insert(endpoints)
          .values({
            ...input,
            userId: ctx.session.user.id,
            workspaceId: workspace.id,
          })
          .returning({ id: endpoints.id });

        if (!result[0]) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create endpoint",
          });
        }

        return result[0];
      } catch (error) {
        console.error(error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create endpoint",
        });
      }
    }),
  byId: protectedProcedure.input(z.string()).query(async ({ ctx, input }) => {
    try {
      const endpoint = await ctx.db.query.endpoints.findFirst({
        where: (endpoints, { eq }) =>
          and(
            eq(endpoints.id, input),
            eq(endpoints.userId, ctx.session.user.id),
          ),
      });

      if (!endpoint) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Endpoint not found",
        });
      }

      return endpoint;
    } catch (error) {
      console.error(error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to get endpoint",
      });
    }
  }),
  list: protectedProcedure
    .input(z.object({ workspaceId: z.string().cuid2() }))
    .query(async ({ ctx, input }) => {
      try {
        return await ctx.db
          .select()
          .from(endpoints)
          .where(
            and(
              eq(endpoints.userId, ctx.session.user.id),
              eq(endpoints.workspaceId, input.workspaceId),
            ),
          );
      } catch (error) {
        console.error(error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to list endpoints",
        });
      }
    }),
  update: protectedProcedure
    .input(updateEndpointSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db
          .update(endpoints)
          .set(input.payload)
          .where(
            and(
              eq(endpoints.id, input.where.id),
              eq(endpoints.userId, ctx.session.user.id),
            ),
          );
      } catch (error) {
        console.error(error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update endpoint",
        });
      }
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.string().cuid2() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db
          .delete(endpoints)
          .where(
            and(
              eq(endpoints.id, input.id),
              eq(endpoints.userId, ctx.session.user.id),
            ),
          );
      } catch (error) {
        console.error(error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete endpoint",
        });
      }
    }),
} satisfies TRPCRouterRecord;
