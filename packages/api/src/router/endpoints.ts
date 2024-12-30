import { and, eq } from "@integramind/db";
import { conversations, endpoints } from "@integramind/db/schema";
import {
  insertEndpointSchema,
  updateEndpointSchema,
} from "@integramind/shared/validators/endpoints";
import { TRPCError, type TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure } from "../trpc";

export const endpointsRouter = {
  create: protectedProcedure
    .input(insertEndpointSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await ctx.db.transaction(async (tx) => {
          const project = await tx.query.projects.findFirst({
            where: (projects, { eq }) =>
              and(
                eq(projects.id, input.projectId),
                eq(projects.userId, ctx.session.user.id),
              ),
          });

          if (!project) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Project not found",
            });
          }

          const conversation = await tx
            .insert(conversations)
            .values({
              userId: ctx.session.user.id,
            })
            .returning({ id: conversations.id });

          if (!conversation[0]) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create conversation",
            });
          }

          const result = await tx
            .insert(endpoints)
            .values({
              ...input,
              userId: ctx.session.user.id,
              projectId: project.id,
              conversationId: conversation[0].id,
            })
            .returning({ id: endpoints.id });

          if (!result[0]) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create endpoint",
            });
          }

          return result[0];
        });
        return result;
      } catch (error) {
        console.error(error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create endpoint",
        });
      }
    }),
  byId: protectedProcedure
    .input(z.object({ id: z.string().cuid2() }))
    .query(async ({ ctx, input }) => {
      try {
        const endpoint = await ctx.db.query.endpoints.findFirst({
          where: (endpoints, { eq }) =>
            and(
              eq(endpoints.id, input.id),
              eq(endpoints.userId, ctx.session.user.id),
            ),
          columns: {
            code: false,
            packages: false,
          },
          with: {
            conversation: {
              with: {
                messages: {
                  columns: {
                    content: false,
                  },
                },
              },
            },
          },
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
        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get endpoint",
        });
      }
    }),
  list: protectedProcedure
    .input(z.object({ projectId: z.string().cuid2() }))
    .query(async ({ ctx, input }) => {
      try {
        return await ctx.db.query.endpoints.findMany({
          where: and(
            eq(endpoints.userId, ctx.session.user.id),
            eq(endpoints.projectId, input.projectId),
          ),
          columns: {
            id: true,
            method: true,
            path: true,
          },
        });
      } catch (error) {
        console.error(error);
        if (error instanceof TRPCError) {
          throw error;
        }

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
        const result = (
          await ctx.db
            .update(endpoints)
            .set(input.payload)
            .where(
              and(
                eq(endpoints.id, input.where.id),
                eq(endpoints.userId, ctx.session.user.id),
              ),
            )
            .returning()
        )[0];

        if (!result) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Failed to update endpoint",
          });
        }

        return result;
      } catch (error) {
        console.error(error);
        if (error instanceof TRPCError) {
          throw error;
        }

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
        const endpoint = await ctx.db.query.endpoints.findFirst({
          where: (endpoints, { eq }) =>
            and(
              eq(endpoints.id, input.id),
              eq(endpoints.userId, ctx.session.user.id),
            ),
        });

        if (!endpoint) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Endpoint not found",
          });
        }

        await ctx.db
          .delete(endpoints)
          .where(
            and(
              eq(endpoints.id, input.id),
              eq(endpoints.userId, ctx.session.user.id),
            ),
          );

        await ctx.db
          .delete(conversations)
          .where(eq(conversations.id, endpoint.conversationId));
      } catch (error) {
        console.error(error);
        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete endpoint",
        });
      }
    }),
} satisfies TRPCRouterRecord;
