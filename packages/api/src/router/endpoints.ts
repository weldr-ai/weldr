import { and, eq, gt } from "@integramind/db";
import {
  conversationMessages,
  conversations,
  endpointVersions,
  endpoints,
} from "@integramind/db/schema";
import type {
  OpenApiEndpointSpec,
  Package,
  RequirementResource,
} from "@integramind/shared/types";
import {
  createNewEndpointVersionSchema,
  insertEndpointSchema,
  updateEndpointSchema,
} from "@integramind/shared/validators/endpoints";
import { TRPCError, type TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure } from "../trpc";
import {
  generateEndpointVersionHash,
  hasDependencyMismatch,
  isEndpointReady,
  isMissingDependencies,
} from "../utils";

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

          const result = await tx
            .insert(endpoints)
            .values({
              ...input,
              userId: ctx.session.user.id,
              projectId: project.id,
              conversationId: conversation.id,
            })
            .returning();

          if (!result[0]) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create endpoint",
            });
          }

          return {
            ...result[0],
            conversationId: conversation.id,
            conversation: {
              ...conversation,
              messages: [],
            },
          };
        });

        return {
          ...result,
          canRun: await isEndpointReady({ id: result.id }),
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
          where: (endpoints, { eq }) =>
            and(
              eq(endpoints.id, input.id),
              eq(endpoints.userId, ctx.session.user.id),
            ),
          with: {
            currentVersion: true,
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
                    endpointVersion: {
                      columns: {
                        id: true,
                        versionTitle: true,
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

        const { currentVersion, ...rest } = result;
        const { id, code, packages, resources, hash, ...currentVersionRest } =
          currentVersion ?? {};

        return {
          ...rest,
          ...currentVersionRest,
          canRun: await isEndpointReady({ id: result.id }),
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
        const existingEndpoint = await ctx.db.query.endpoints.findFirst({
          where: eq(endpoints.id, input.where.id),
          with: {
            currentVersion: true,
          },
        });

        if (!existingEndpoint) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Endpoint not found",
          });
        }

        if (
          input.payload.openApiSpec?.method &&
          input.payload.openApiSpec?.path
        ) {
          const isUnique =
            (await ctx.db.query.endpoints.findFirst({
              where: and(
                eq(endpoints.projectId, existingEndpoint.projectId),
                eq(endpoints.method, input.payload.openApiSpec?.method),
                eq(endpoints.path, input.payload.openApiSpec?.path),
              ),
            })) !== undefined;

          if (isUnique && existingEndpoint.id !== input.where.id) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Endpoint with this method and path already exists",
            });
          }
        }

        const newVersion = await ctx.db.transaction(async (tx) => {
          const versionData = {
            openApiSpec: (input.payload.openApiSpec ??
              existingEndpoint.currentVersion
                ?.openApiSpec) as OpenApiEndpointSpec,
            code: (input.payload.code ??
              existingEndpoint.currentVersion?.code) as string,
            packages: (input.payload.packages ??
              existingEndpoint.currentVersion?.packages) as Package[],
            resources: (input.payload.resources ??
              existingEndpoint.currentVersion
                ?.resources) as RequirementResource[],
          };

          const hash = generateEndpointVersionHash(versionData);

          const newVersion = (
            await tx
              .insert(endpointVersions)
              .values({
                ...versionData,
                versionTitle: input.payload.versionTitle,
                versionNumber:
                  (existingEndpoint.currentVersion?.versionNumber ?? 0) + 1,
                hash,
                endpointId: existingEndpoint.id,
                userId: ctx.session.user.id,
                messageId: input.payload.messageId,
              })
              .returning({
                id: endpointVersions.id,
              })
          )[0];

          if (!newVersion) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create new endpoint version",
            });
          }

          await tx
            .update(endpoints)
            .set({
              path: input.payload.openApiSpec?.path,
              method: input.payload.openApiSpec?.method,
              currentVersionId: newVersion.id,
            })
            .where(eq(endpoints.id, existingEndpoint.id));

          return newVersion;
        });

        return newVersion;
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
  revertToPreviousVersion: protectedProcedure
    .input(z.object({ versionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db.transaction(async (tx) => {
          const previousVersion = await tx.query.endpointVersions.findFirst({
            where: and(
              eq(endpointVersions.id, input.versionId),
              eq(endpointVersions.userId, ctx.session.user.id),
            ),
            with: {
              message: true,
              endpoint: true,
            },
          });

          if (!previousVersion || !previousVersion.endpoint) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Previous version or endpoint not found",
            });
          }

          // Check for missing dependencies
          const isMissingDeps = await isMissingDependencies(
            previousVersion.id,
            "endpoint",
          );

          if (isMissingDeps) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                "Cannot revert to this version because some or all of its dependencies are missing",
            });
          }

          // Check for dependency mismatch
          const hasMismatch = await hasDependencyMismatch(
            previousVersion.id,
            "endpoint",
          );

          if (hasMismatch) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                "Cannot revert to this version because its dependencies have incompatible changes",
            });
          }

          if (!previousVersion.openApiSpec) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                "Cannot revert to this version because it has no API specification",
            });
          }

          await tx
            .update(endpoints)
            .set({
              currentVersionId: previousVersion.id,
              path: previousVersion.openApiSpec.path,
              method: previousVersion.openApiSpec.method,
            })
            .where(eq(endpoints.id, previousVersion.endpoint.id));

          // Delete all versions after the previous version
          await tx
            .delete(endpointVersions)
            .where(
              and(
                eq(endpointVersions.endpointId, previousVersion.endpoint.id),
                gt(endpointVersions.createdAt, previousVersion.createdAt),
              ),
            );

          // Delete the messages after the previous version
          await tx
            .delete(conversationMessages)
            .where(
              and(
                eq(
                  conversationMessages.conversationId,
                  previousVersion.message.conversationId,
                ),
                gt(conversationMessages.createdAt, previousVersion.createdAt),
              ),
            );
        });
      } catch (error) {
        console.error(error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to revert to previous version",
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
