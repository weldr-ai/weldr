import { and, eq } from "@integramind/db";
import { projects, resourceEnvironmentVariables } from "@integramind/db/schema";
import {
  insertProjectSchema,
  updateProjectSchema,
} from "@integramind/shared/validators/projects";
import { createId } from "@paralleldrive/cuid2";
import { TRPCError, type TRPCRouterRecord } from "@trpc/server";
import { ofetch } from "ofetch";
import { z } from "zod";
import { protectedProcedure } from "../trpc";

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
              columns: {
                code: false,
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
            },
            funcs: {
              columns: {
                docs: false,
                npmDependencies: false,
              },
              with: {
                module: {
                  columns: {
                    id: true,
                    name: true,
                  },
                },
                testRuns: true,
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
            },
            modules: true,
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
          funcs: project.funcs.map((func) => ({
            ...func,
            code: undefined,
            canRun: Boolean(func.code),
          })),
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
            columns: {
              code: false,
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
          },
          funcs: {
            columns: {
              docs: false,
              npmDependencies: false,
            },
            with: {
              module: {
                columns: {
                  id: true,
                  name: true,
                },
              },
              testRuns: true,
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
          },
          modules: true,
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
        result.push({
          type: "endpoint",
          id: endpoint.id,
          dragHandle: ".drag-handle",
          position: { x: endpoint.positionX ?? 0, y: endpoint.positionY ?? 0 },
          data: endpoint,
        });
      }

      for (const module of project.modules) {
        result.push({
          type: "module",
          id: module.id,
          dragHandle: ".drag-handle",
          position: { x: module.positionX ?? 0, y: module.positionY ?? 0 },
          width: module.width ?? 600,
          height: module.height ?? 400,
          data: module,
        });
      }

      for (const func of project.funcs) {
        result.push({
          type: "func",
          id: func.id,
          dragHandle: ".drag-handle",
          parentId: func.moduleId,
          extent: "parent",
          position: { x: func.positionX ?? 0, y: func.positionY ?? 0 },
          data: {
            ...func,
            code: undefined,
            canRun: Boolean(func.code),
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
} satisfies TRPCRouterRecord;
