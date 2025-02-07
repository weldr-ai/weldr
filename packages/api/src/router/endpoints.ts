import { TRPCError, type TRPCRouterRecord } from "@trpc/server";
import { and, eq } from "@weldr/db";
import {
  conversationMessages,
  conversations,
  dependencies,
  endpointDefinitionPackages,
  endpointDefinitionResources,
  endpointDefinitions,
  endpoints,
  packages,
} from "@weldr/db/schema";
import {
  createEndpointDefinitionSchema,
  insertEndpointSchema,
  updateEndpointSchema,
} from "@weldr/shared/validators/endpoints";
import { createPatch } from "diff";
import { z } from "zod";
import { protectedProcedure } from "../trpc";
import {
  createVersion,
  defineVersion,
  isEndpointReady,
  wouldCreateCycle,
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

          return {
            ...newEndpoint,
            conversationId: conversation.id,
            conversation: {
              ...conversation,
              messages: [],
            },
          };
        });

        const { currentDefinitionId, ...rest } = result;

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
            ),
          with: {
            currentDefinition: {
              columns: {
                path: true,
                method: true,
                openApiSpec: true,
              },
            },
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

        const { currentDefinitionId, currentDefinition, ...rest } = result;

        return {
          ...rest,
          ...currentDefinition,
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
  define: protectedProcedure
    .input(createEndpointDefinitionSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db.transaction(async (tx) => {
          const endpoint = await ctx.db.query.endpoints.findFirst({
            where: and(
              eq(endpoints.id, input.where.id),
              eq(endpoints.userId, ctx.session.user.id),
            ),
          });

          if (!endpoint || !endpoint.conversationId) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Endpoint not found",
            });
          }

          const {
            resources,
            packages: pkgs,
            helperFunctionIds,
            ...rest
          } = input.payload;

          const path = rest.openApiSpec.path.replace(/\{[^[\]]+\}/g, "[$1]");

          const diff = await createPatch(
            `${path}/${rest.openApiSpec.method}/index.ts`,
            "",
            input.payload.code,
          );

          const assistantBuiltMessage = await ctx.db
            .insert(conversationMessages)
            .values({
              role: "assistant",
              content: "Your endpoint has been built successfully!",
              rawContent: [
                {
                  type: "text",
                  value: "Your endpoint has been built successfully!",
                },
              ],
              conversationId: endpoint.conversationId,
              userId: ctx.session.user.id,
            })
            .returning()
            .then(([message]) => message);

          if (!assistantBuiltMessage) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create new function version",
            });
          }

          const { newVersion, previousVersion } = await createVersion({
            db: tx,
            versionName: `${rest.openApiSpec.summary} (created)`,
            projectId: endpoint.projectId,
            userId: ctx.session.user.id,
            messageId: assistantBuiltMessage.id,
          });

          const newDefinition = await tx
            .insert(endpointDefinitions)
            .values({
              versionId: newVersion.id,
              path: rest.openApiSpec.path,
              method: rest.openApiSpec.method,
              userId: ctx.session.user.id,
              endpointId: endpoint.id,
              diff,
              ...rest,
            })
            .returning()
            .then(([endpoint]) => endpoint);

          if (
            !newDefinition ||
            !newDefinition.id ||
            !newDefinition.openApiSpec?.summary
          ) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create endpoint",
            });
          }

          await tx
            .update(endpoints)
            .set({
              currentDefinitionId: newDefinition.id,
            })
            .where(eq(endpoints.id, endpoint.id));

          if (resources) {
            for (const resource of resources) {
              await ctx.db.insert(endpointDefinitionResources).values({
                endpointDefinitionId: newDefinition.id,
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
                  projectId: endpoint.projectId,
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
                .insert(endpointDefinitionPackages)
                .values({
                  endpointDefinitionId: newDefinition.id,
                  packageId: newPkg.id,
                })
                .onConflictDoNothing();
            }
          }

          if (helperFunctionIds) {
            for (const helperFunctionId of helperFunctionIds) {
              const isCycle = await wouldCreateCycle({
                dependentId: newDefinition.endpointId,
                dependencyId: helperFunctionId,
                db: tx,
              });

              if (isCycle) {
                throw new TRPCError({
                  code: "BAD_REQUEST",
                  message: "Dependency cycle detected",
                });
              }

              await tx.insert(dependencies).values({
                dependentDefinitionId: newDefinition.id,
                dependentType: "endpoint",
                dependencyDefinitionId: helperFunctionId,
                dependencyType: "function",
              });
            }
          }

          await defineVersion({
            db: tx,
            previousVersionId: previousVersion.id,
            newVersionId: newVersion.id,
            addedEndpointDefinitionIds: [newDefinition.id],
          });
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
            with: {
              currentDefinition: true,
            },
            where: (endpoints, { eq, and }) =>
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

          if (endpoint.currentDefinition) {
            try {
              const { newVersion, previousVersion } = await createVersion({
                db: tx,
                versionName: `${endpoint.currentDefinition.openApiSpec.summary} (deleted)`,
                projectId: endpoint.projectId,
                userId: ctx.session.user.id,
              });

              await defineVersion({
                db: tx,
                previousVersionId: previousVersion.id,
                newVersionId: newVersion.id,
                deletedEndpointDefinitionIds: [endpoint.currentDefinition.id],
              });
            } catch (error) {
              console.error(error);
              throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to delete endpoint",
              });
            }
          } else {
            await tx.delete(endpoints).where(eq(endpoints.id, endpoint.id));
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
