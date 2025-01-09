import { type InferInsertModel, and, eq } from "@integramind/db";
import {
  conversations,
  endpointPackages,
  endpointResources,
  endpoints,
  packages,
  versionEndpoints,
  versions,
} from "@integramind/db/schema";
import {
  createNewEndpointVersionSchema,
  insertEndpointSchema,
  updateEndpointSchema,
} from "@integramind/shared/validators/endpoints";
import { TRPCError, type TRPCRouterRecord } from "@trpc/server";
import { createPatch } from "diff";
import { z } from "zod";
import { protectedProcedure } from "../trpc";
import { createVersion, isEndpointReady } from "../utils";

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
            .returning()
            .then(([conversation]) => conversation);

          if (!conversation) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create conversation",
            });
          }

          const newEndpoint = await tx
            .insert(endpoints)
            .values({
              ...input,
              userId: ctx.session.user.id,
              projectId: project.id,
              conversationId: conversation.id,
            })
            .returning()
            .then(([endpoint]) => endpoint);

          if (!newEndpoint) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create endpoint",
            });
          }

          const currentVersion = await tx.query.versions.findFirst({
            where: and(
              eq(versions.projectId, input.projectId),
              eq(versions.isActive, true),
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

        const { code, diff, isDeleted, isDeployed, parentId, ...rest } = result;
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
              eq(endpoints.isDeleted, false),
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

        const { code, diff, isDeleted, isDeployed, parentId, ...rest } = result;
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
              eq(endpoints.isDeleted, false),
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
        await ctx.db.transaction(async (tx) => {
          const endpoint = await ctx.db.query.endpoints.findFirst({
            where: and(
              eq(endpoints.id, input.where.id),
              eq(endpoints.userId, ctx.session.user.id),
              eq(endpoints.isDeleted, false),
            ),
          });

          if (!endpoint) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Endpoint not found",
            });
          }

          const {
            resources,
            packages: pkgs,
            messageId,
            ...rest
          } = input.payload;
          const firstImplementation = !endpoint.code;
          let newEndpoint: InferInsertModel<typeof endpoints> | undefined;

          if (!endpoint.code) {
            newEndpoint = await ctx.db
              .update(endpoints)
              .set({
                ...rest,
              })
              .where(eq(endpoints.id, endpoint.id))
              .returning()
              .then(([endpoint]) => endpoint);
          } else {
            newEndpoint = await ctx.db
              .insert(endpoints)
              .values({
                ...endpoint,
                ...rest,
                parentId: endpoint.id,
              })
              .returning()
              .then(([endpoint]) => endpoint);
          }

          if (
            !newEndpoint ||
            !newEndpoint.id ||
            !newEndpoint.projectId ||
            !newEndpoint.openApiSpec?.summary
          ) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create endpoint",
            });
          }

          if (resources) {
            for (const resource of resources) {
              await ctx.db.insert(endpointResources).values({
                endpointId: newEndpoint.id,
                resourceId: resource.id,
                metadata: resource,
              });
            }
          }

          if (pkgs) {
            for (const pkg of pkgs) {
              const newPkg = await tx
                .insert(packages)
                .values({
                  ...pkg,
                  projectId: newEndpoint.projectId,
                })
                .onConflictDoNothing()
                .returning()
                .then(([pkg]) => pkg);

              if (!newPkg) {
                throw new TRPCError({
                  code: "INTERNAL_SERVER_ERROR",
                  message: "Failed to create package",
                });
              }

              await tx
                .insert(endpointPackages)
                .values({
                  endpointId: newEndpoint.id,
                  packageId: newPkg.id,
                })
                .onConflictDoNothing();
            }
          }

          // If endpoint is implemented, create a new version and delete the old endpoint
          // else, just create a new version with the new endpoint
          try {
            await createVersion({
              db: ctx.db,
              tx: tx,
              input: {
                userId: ctx.session.user.id,
                projectId: newEndpoint.projectId,
                versionName: `${newEndpoint.openApiSpec.summary} (${
                  firstImplementation ? "created" : "updated"
                })`,
                addedEndpointIds: [newEndpoint.id],
                deletedEndpointIds: firstImplementation ? [] : [endpoint.id],
                messageId,
              },
            });
          } catch (error) {
            console.error(error);
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create new endpoint version",
            });
          }
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
        await ctx.db.transaction(async (tx) => {
          const endpoint = await tx.query.endpoints.findFirst({
            where: (endpoints, { eq, and }) =>
              and(
                eq(endpoints.id, input.id),
                eq(endpoints.userId, ctx.session.user.id),
                eq(endpoints.isDeleted, false),
              ),
          });

          if (!endpoint) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Endpoint not found",
            });
          }

          let diff: string | undefined;

          if (endpoint.path && endpoint.code) {
            const path = endpoint.path.replace(/\{[^[\]]+\}/g, "[$1]");

            diff = createPatch(
              `${path}/${endpoint.method}/index.ts`,
              endpoint.code,
              "",
            );
          }

          await tx
            .update(endpoints)
            .set({
              isDeployed: false,
              isDeleted: true,
              diff,
            })
            .where(
              and(
                eq(endpoints.id, input.id),
                eq(endpoints.userId, ctx.session.user.id),
                eq(endpoints.isDeleted, false),
              ),
            );

          // If endpoint is implemented, create a new version and delete the old endpoint
          // else, just delete the endpoint from the current version
          if (endpoint.openApiSpec?.summary) {
            try {
              await createVersion({
                db: ctx.db,
                tx: tx,
                input: {
                  userId: ctx.session.user.id,
                  projectId: endpoint.projectId,
                  versionName: `${endpoint.openApiSpec.summary} (deleted)`,
                  deletedEndpointIds: [endpoint.id],
                },
              });
            } catch (error) {
              console.error(error);
              throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to delete endpoint",
              });
            }
          } else {
            await tx
              .delete(versionEndpoints)
              .where(eq(versionEndpoints.endpointId, endpoint.id));
          }
        });
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
