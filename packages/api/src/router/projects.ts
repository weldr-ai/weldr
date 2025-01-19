import { and, eq } from "@integramind/db";
import {
  projects,
  resourceEnvironmentVariables,
  versions,
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

export const projectsRouter = {
  create: protectedProcedure
    .input(insertProjectSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await ctx.db.transaction(async (tx) => {
          const projectId = createId();

          if (process.env.NODE_ENV !== "development") {
            const response = await fetch("https://api.machines.dev/v1/apps", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.FLY_API_KEY}`,
              },
              body: JSON.stringify({
                app_name: `preview-${projectId}`,
                enable_subdomains: true,
                network: `net-${projectId}`,
                org_slug: process.env.FLY_ORG_SLUG,
              }),
            });

            if (!response.ok) {
              throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to create project",
              });
            }
          }

          const project = await tx
            .insert(projects)
            .values({
              id: projectId,
              name: input.name,
              subdomain: projectId,
              description: input.description,
              userId: ctx.session.user.id,
            })
            .returning()
            .then(([project]) => project);

          if (!project) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create project",
            });
          }

          await tx.insert(versions).values({
            projectId: project.id,
            isActive: true,
            versionName: `${project.name} (initiated)`,
            versionNumber: 1,
            userId: ctx.session.user.id,
          });

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
        const result = await ctx.db
          .update(projects)
          .set(input.payload)
          .where(
            and(
              eq(projects.id, input.where.id),
              eq(projects.userId, ctx.session.user.id),
            ),
          )
          .returning()
          .then(([project]) => project);

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
