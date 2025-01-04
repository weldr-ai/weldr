import { and, eq, inArray } from "@integramind/db";
import {
  dependencies,
  projects,
  resourceEnvironmentVariables,
} from "@integramind/db/schema";
import {
  insertProjectSchema,
  updateProjectSchema,
} from "@integramind/shared/validators/projects";
import { createId } from "@paralleldrive/cuid2";
import { TRPCError, type TRPCRouterRecord } from "@trpc/server";
import { ofetch } from "ofetch";
import { z } from "zod";
import { protectedProcedure } from "../trpc";
import { isEndpointReady, isFunctionReady } from "../utils";

export const projectsRouter = {
  create: protectedProcedure
    .input(insertProjectSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await ctx.db.transaction(async (tx) => {
          const projectId = createId();

          const response = await ofetch<{ engineMachineId: string }>(
            `${process.env.DEPLOYER_API_URL}/projects`,
            {
              method: "POST",
              retry: 3,
              retryDelay: 1000,
              body: {
                projectId,
              },
              async onRequestError({ request, options, error }) {
                console.log("[fetch request error]", request, error);
                throw new TRPCError({
                  code: "INTERNAL_SERVER_ERROR",
                  message: "Failed to create project",
                });
              },
              async onResponseError({ request, response, options }) {
                console.log("[fetch response error]", request, response);
                throw new TRPCError({
                  code: "INTERNAL_SERVER_ERROR",
                  message: "Failed to create project",
                });
              },
            },
          );

          if (!response.engineMachineId) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create project",
            });
          }

          const project = (
            await tx
              .insert(projects)
              .values({
                id: projectId,
                name: input.name,
                subdomain: input.subdomain,
                description: input.description,
                userId: ctx.session.user.id,
                engineMachineId: response.engineMachineId,
              })
              .returning({ id: projects.id })
          )[0];

          if (!project) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create project",
            });
          }

          return project;
        });
      } catch (error) {
        console.error(error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create project",
        });
      }
    }),
  list: protectedProcedure.query(async ({ ctx }) => {
    try {
      const result = await ctx.db.query.projects.findMany({
        where: eq(projects.userId, ctx.session.user.id),
      });
      return result;
    } catch (error) {
      console.error(error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to list projects",
      });
    }
  }),
  byId: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const project = await ctx.db.query.projects.findFirst({
          where: and(
            eq(projects.id, input.id),
            eq(projects.userId, ctx.session.user.id),
          ),
          with: {
            environmentVariables: {
              columns: {
                secretId: false,
              },
            },
            endpoints: {
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
                      orderBy: (funcsMessages, { asc }) => [
                        asc(funcsMessages.createdAt),
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
            },
            funcs: {
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
                      orderBy: (funcsMessages, { asc }) => [
                        asc(funcsMessages.createdAt),
                      ],
                      with: {
                        funcVersion: {
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
            },
            resources: {
              columns: {
                id: true,
                name: true,
                description: true,
              },
              with: {
                integration: true,
              },
            },
          },
        });

        if (!project) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Project not found",
          });
        }

        const resourceEnvs = await Promise.all(
          project.resources.map(async (resource) => {
            const data =
              await ctx.db.query.resourceEnvironmentVariables.findMany({
                where: eq(resourceEnvironmentVariables.resourceId, resource.id),
                with: {
                  environmentVariable: {
                    columns: {
                      key: true,
                    },
                  },
                },
              });
            return {
              ...resource,
              environmentVariables: data.map((rev) => ({
                id: rev.environmentVariableId,
                mapTo: rev.mapTo,
                userKey: rev.environmentVariable.key,
              })),
            };
          }),
        );

        const result = {
          ...project,
          funcs: await Promise.all(
            project.funcs.map(async (func) => {
              const { currentVersion, ...rest } = func;
              const {
                id,
                code,
                packages,
                docs,
                resources,
                hash,
                messageId,
                ...currentVersionRest
              } = currentVersion ?? {};
              return {
                ...rest,
                ...currentVersionRest,
                canRun: await isFunctionReady({ id: func.id }),
              };
            }),
          ),
          endpoints: await Promise.all(
            project.endpoints.map(async (endpoint) => {
              const { currentVersion, ...rest } = endpoint;
              const {
                id,
                code,
                packages,
                resources,
                hash,
                messageId,
                ...currentVersionRest
              } = currentVersion ?? {};
              return {
                ...rest,
                ...currentVersionRest,
                canRun: await isEndpointReady({ id: endpoint.id }),
              };
            }),
          ),
          resources: resourceEnvs,
        };

        return result;
      } catch (error) {
        console.error(error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get project",
        });
      }
    }),
  update: protectedProcedure
    .input(updateProjectSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const result = (
          await ctx.db
            .update(projects)
            .set(input.payload)
            .where(
              and(
                eq(projects.id, input.where.id),
                eq(projects.userId, ctx.session.user.id),
              ),
            )
            .returning()
        )[0];

        if (!result) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Project not found",
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
          message: "Failed to update project",
        });
      }
    }),
  nodes: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await ctx.db.query.projects.findFirst({
        where: and(
          eq(projects.id, input.id),
          eq(projects.userId, ctx.session.user.id),
        ),
        with: {
          endpoints: {
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
                    orderBy: (funcsMessages, { asc }) => [
                      asc(funcsMessages.createdAt),
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
          },
          funcs: {
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
                    orderBy: (funcsMessages, { asc }) => [
                      asc(funcsMessages.createdAt),
                    ],
                    with: {
                      funcVersion: {
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
          },
        },
      });

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      const result = [];

      for (const endpoint of project.endpoints) {
        const { currentVersion, ...rest } = endpoint;
        const {
          id,
          code,
          packages,
          resources,
          hash,
          messageId,
          ...currentVersionRest
        } = currentVersion ?? {};
        result.push({
          type: "endpoint",
          id: endpoint.id,
          dragHandle: ".drag-handle",
          position: { x: endpoint.positionX ?? 0, y: endpoint.positionY ?? 0 },
          data: {
            ...rest,
            ...currentVersionRest,
            canRun: await isEndpointReady({ id: endpoint.id }),
          },
        });
      }

      for (const func of project.funcs) {
        const { currentVersion, ...rest } = func;
        const {
          id,
          code,
          packages,
          resources,
          hash,
          messageId,
          ...currentVersionRest
        } = currentVersion ?? {};
        result.push({
          type: "func",
          id: func.id,
          dragHandle: ".drag-handle",
          position: { x: func.positionX ?? 0, y: func.positionY ?? 0 },
          data: {
            ...rest,
            ...currentVersionRest,
            canRun: await isFunctionReady({ id: func.id }),
          },
        });
      }

      return result;
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const project = await ctx.db.query.projects.findFirst({
          where: and(
            eq(projects.id, input.id),
            eq(projects.userId, ctx.session.user.id),
          ),
        });

        if (!project) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Project not found",
          });
        }

        const response = await ofetch(
          `${process.env.DEPLOYER_API_URL}/projects`,
          {
            method: "DELETE",
            retry: 3,
            retryDelay: 1000,
            body: {
              projectId: input.id,
            },
          },
        );

        if (response.status !== 200) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to delete project",
          });
        }

        await ctx.db
          .delete(projects)
          .where(
            and(
              eq(projects.id, input.id),
              eq(projects.userId, ctx.session.user.id),
            ),
          );
      } catch (error) {
        console.error(error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete project",
        });
      }
    }),
  dependencies: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await ctx.db.query.projects.findFirst({
        where: and(
          eq(projects.id, input.id),
          eq(projects.userId, ctx.session.user.id),
        ),
        with: {
          funcs: {
            columns: {
              id: true,
            },
            with: {
              currentVersion: {
                columns: {
                  id: true,
                },
              },
            },
          },
          endpoints: {
            columns: {
              id: true,
            },
            with: {
              currentVersion: {
                columns: {
                  id: true,
                },
              },
            },
          },
        },
      });

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      // Get all current version IDs
      const currentVersionIds = [
        ...project.funcs
          .map((f) => f.currentVersion?.id)
          .filter((id): id is string => !!id),
        ...project.endpoints
          .map((e) => e.currentVersion?.id)
          .filter((id): id is string => !!id),
      ];

      // Get dependencies only for current versions in this project
      const projectDependencies = await ctx.db.query.dependencies.findMany({
        where: and(inArray(dependencies.dependentVersionId, currentVersionIds)),
        with: {
          dependentEndpointVersion: {
            columns: {
              endpointId: true,
            },
          },
          dependentFuncVersion: {
            columns: {
              funcId: true,
            },
          },
          dependencyVersion: {
            columns: {
              funcId: true,
            },
          },
        },
      });

      // Create a unique set of edges using a Set with stringified edges
      const uniqueEdgesSet = new Set<string>();
      const edges: { dependantId: string; dependencyId: string }[] = [];

      for (const dep of projectDependencies) {
        if (dep.dependencyVersion) {
          let edge = "";
          if (dep.dependentEndpointVersion) {
            edge = JSON.stringify({
              dependantId: dep.dependentEndpointVersion.endpointId,
              dependencyId: dep.dependencyVersion.funcId,
            });
          } else {
            edge = JSON.stringify({
              dependantId: dep.dependentFuncVersion.funcId,
              dependencyId: dep.dependencyVersion.funcId,
            });
          }

          if (!uniqueEdgesSet.has(edge)) {
            uniqueEdgesSet.add(edge);
            if (dep.dependentEndpointVersion?.endpointId) {
              edges.push({
                dependantId: dep.dependentEndpointVersion.endpointId,
                dependencyId: dep.dependencyVersion.funcId,
              });
            } else {
              edges.push({
                dependantId: dep.dependentFuncVersion.funcId,
                dependencyId: dep.dependencyVersion.funcId,
              });
            }
          }
        }
      }

      return edges;
    }),
} satisfies TRPCRouterRecord;
