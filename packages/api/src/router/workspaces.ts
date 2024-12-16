import { and, eq } from "@integramind/db";
import {
  resourceEnvironmentVariables,
  workspaces,
} from "@integramind/db/schema";
import {
  insertWorkspaceSchema,
  updateWorkspaceSchema,
} from "@integramind/shared/validators/workspaces";
import { createId } from "@paralleldrive/cuid2";
import { TRPCError, type TRPCRouterRecord } from "@trpc/server";
import { ofetch } from "ofetch";
import { z } from "zod";
import { protectedProcedure } from "../trpc";

export const workspacesRouter = {
  create: protectedProcedure
    .input(insertWorkspaceSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await ctx.db.transaction(async (tx) => {
          const workspaceId = createId();

          const response = await ofetch<{ engineMachineId: string }>(
            `${process.env.DEPLOYER_API_URL}/apps`,
            {
              method: "POST",
              retry: 3,
              retryDelay: 1000,
              body: {
                appId: workspaceId,
              },
              async onRequestError({ request, options, error }) {
                console.log("[fetch request error]", request, error);
                throw new TRPCError({
                  code: "INTERNAL_SERVER_ERROR",
                  message: "Failed to create workspace",
                });
              },
              async onResponseError({ request, response, options }) {
                console.log("[fetch response error]", request, response);
                throw new TRPCError({
                  code: "INTERNAL_SERVER_ERROR",
                  message: "Failed to create workspace",
                });
              },
            },
          );

          if (!response.engineMachineId) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create workspace",
            });
          }

          const workspace = (
            await tx
              .insert(workspaces)
              .values({
                id: workspaceId,
                name: input.name,
                subdomain: input.subdomain,
                description: input.description,
                userId: ctx.session.user.id,
                engineMachineId: response.engineMachineId,
              })
              .returning({ id: workspaces.id })
          )[0];

          if (!workspace) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create workspace",
            });
          }

          return workspace;
        });
      } catch (error) {
        console.error(error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create workspace",
        });
      }
    }),
  list: protectedProcedure.query(async ({ ctx }) => {
    try {
      const result = await ctx.db.query.workspaces.findMany({
        where: eq(workspaces.userId, ctx.session.user.id),
      });
      return result;
    } catch (error) {
      console.error(error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to list workspaces",
      });
    }
  }),
  byId: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const workspace = await ctx.db.query.workspaces.findFirst({
          where: and(
            eq(workspaces.id, input.id),
            eq(workspaces.userId, ctx.session.user.id),
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
                integration: {
                  with: {
                    modules: {
                      with: {
                        funcs: true,
                      },
                    },
                  },
                },
              },
            },
            endpoints: true,
            modules: true,
          },
        });

        if (!workspace) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Workspace not found",
          });
        }

        const resourceEnvs = await Promise.all(
          workspace.resources.map(async (resource) => {
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
          ...workspace,
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
          message: "Failed to get workspace",
        });
      }
    }),
  update: protectedProcedure
    .input(updateWorkspaceSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const result = (
          await ctx.db
            .update(workspaces)
            .set(input.payload)
            .where(
              and(
                eq(workspaces.id, input.where.id),
                eq(workspaces.userId, ctx.session.user.id),
              ),
            )
            .returning()
        )[0];

        if (!result) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Workspace not found",
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
          message: "Failed to update workspace",
        });
      }
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const workspace = await ctx.db.query.workspaces.findFirst({
          where: and(
            eq(workspaces.id, input.id),
            eq(workspaces.userId, ctx.session.user.id),
          ),
        });

        if (!workspace) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Workspace not found",
          });
        }

        const response = await ofetch(`${process.env.DEPLOYER_API_URL}/apps`, {
          method: "DELETE",
          retry: 3,
          retryDelay: 1000,
          body: {
            workspaceId: input.id,
          },
        });

        if (response.status !== 200) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to delete workspace",
          });
        }

        await ctx.db
          .delete(workspaces)
          .where(
            and(
              eq(workspaces.id, input.id),
              eq(workspaces.userId, ctx.session.user.id),
            ),
          );
      } catch (error) {
        console.error(error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete workspace",
        });
      }
    }),
} satisfies TRPCRouterRecord;
