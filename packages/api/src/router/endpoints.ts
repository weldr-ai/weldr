import { and, eq, isNull } from "@integramind/db";
import {
  conversations,
  endpoints,
  versionEndpoints,
  versions,
} from "@integramind/db/schema";
import {
  createNewEndpointVersionSchema,
  insertEndpointSchema,
  updateEndpointSchema,
} from "@integramind/shared/validators/endpoints";
import { TRPCError, type TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure } from "../trpc";
import { isEndpointReady } from "../utils";

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

          const conversation = (
            await tx
              .insert(conversations)
              .values({
                userId: ctx.session.user.id,
              })
              .returning()
          )[0];

          if (!conversation) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create conversation",
            });
          }

          const newEndpoint = (
            await tx
              .insert(endpoints)
              .values({
                ...input,
                userId: ctx.session.user.id,
                projectId: project.id,
                conversationId: conversation.id,
              })
              .returning()
          )[0];

          if (!newEndpoint) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create endpoint",
            });
          }

          const currentVersion = await tx.query.versions.findFirst({
            where: and(
              eq(versions.projectId, input.projectId),
              eq(versions.isCurrent, true),
            ),
            with: {
              endpoints: true,
            },
          });

          if (!currentVersion) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create endpoint",
            });
          }

          await tx.insert(versionEndpoints).values({
            endpointId: newEndpoint.id,
            versionId: currentVersion.id,
          });

          return {
            ...newEndpoint,
            conversationId: conversation.id,
            conversation: {
              ...conversation,
              messages: [],
            },
          };
        });

        const { code, packages, resources, ...rest } = result;
        return {
          ...rest,
          canRun: await isEndpointReady(result),
        };
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
        const result = await ctx.db.query.endpoints.findFirst({
          where: (endpoints, { eq, and }) =>
            and(
              eq(endpoints.id, input.id),
              eq(endpoints.userId, ctx.session.user.id),
              isNull(endpoints.deletedAt),
            ),
          with: {
            conversation: {
              with: {
                messages: {
                  columns: {
                    id: true,
                    role: true,
                    rawContent: true,
                    createdAt: true,
                  },
                  orderBy: (endpointsMessages, { asc }) => [
                    asc(endpointsMessages.createdAt),
                  ],
                  with: {
                    version: {
                      columns: {
                        id: true,
                        versionName: true,
                        versionNumber: true,
                      },
                    },
                  },
                },
              },
            },
          },
        });

        if (!result) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Endpoint not found",
          });
        }

        const { code, packages, resources, deletedAt, ...rest } = result;
        return {
          ...rest,
          canRun: await isEndpointReady(result),
        };
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
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update endpoint",
        });
      }
    }),
  createNewVersion: protectedProcedure
    .input(createNewEndpointVersionSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const endpoint = await ctx.db.query.endpoints.findFirst({
          where: and(
            eq(endpoints.id, input.where.id),
            eq(endpoints.userId, ctx.session.user.id),
          ),
        });

        if (!endpoint) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Endpoint not found",
          });
        }

        if (!endpoint.code) {
          await ctx.db
            .update(endpoints)
            .set(input.payload)
            .where(eq(endpoints.id, endpoint.id));
          return;
        }

        await ctx.db.insert(endpoints).values({
          ...endpoint,
          ...input.payload,
        });
      } catch (error) {
        console.error(error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create new endpoint version",
        });
      }
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.string().cuid2() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const endpoint = await ctx.db.query.endpoints.findFirst({
          where: (endpoints, { eq, and }) =>
            and(
              eq(endpoints.id, input.id),
              eq(endpoints.userId, ctx.session.user.id),
              isNull(endpoints.deletedAt),
            ),
        });

        if (!endpoint) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Endpoint not found",
          });
        }

        await ctx.db
          .update(endpoints)
          .set({
            deletedAt: new Date(),
          })
          .where(
            and(
              eq(endpoints.id, input.id),
              eq(endpoints.userId, ctx.session.user.id),
              isNull(endpoints.deletedAt),
            ),
          );
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
