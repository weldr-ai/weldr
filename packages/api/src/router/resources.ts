import { and, eq } from "@specly/db";
import {
  environmentVariables,
  integrations,
  resourceEnvironmentVariables,
  resources,
  secrets,
  workspaces,
} from "@specly/db/schema";
import { testConnection } from "@specly/shared/integrations/postgres/helpers";
import { insertResourceSchema } from "@specly/shared/validators/resources";
import { TRPCError, type TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure } from "../trpc";

export const resourcesRouter = {
  create: protectedProcedure
    .input(insertResourceSchema)
    .mutation(async ({ ctx, input }) => {
      const workspace = await ctx.db.query.workspaces.findFirst({
        where: eq(workspaces.id, input.workspaceId),
      });

      if (!workspace) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Workspace not found",
        });
      }

      const integration = await ctx.db.query.integrations.findFirst({
        where: eq(integrations.id, input.integrationId),
      });

      switch (integration?.type) {
        case "postgres": {
          const connectionTest = await testConnection({
            host: input.environmentVariables?.POSTGRES_HOST ?? "",
            port: Number.parseInt(
              input.environmentVariables?.POSTGRES_PORT ?? "5432",
            ),
            database: input.environmentVariables?.POSTGRES_DB ?? "",
            user: input.environmentVariables?.POSTGRES_USER ?? "",
            password: input.environmentVariables?.POSTGRES_PASSWORD ?? "",
          });

          if (!connectionTest) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Failed to connect to the database",
            });
          }
        }
      }

      const doesExist = await ctx.db.query.resources.findFirst({
        where: and(
          eq(resources.name, input.name),
          eq(resources.workspaceId, input.workspaceId),
        ),
      });

      if (doesExist) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Resource name must be unique",
        });
      }

      const result = await ctx.db.transaction(async (tx) => {
        try {
          const resource = await tx
            .insert(resources)
            .values({
              name: input.name,
              description: input.description,
              workspaceId: input.workspaceId,
              createdBy: ctx.session.user.id,
              integrationId: input.integrationId,
            })
            .returning({ id: resources.id });

          if (!resource[0]) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create resource",
            });
          }

          for (const key in input.environmentVariables ?? {}) {
            const secret = await tx
              .insert(secrets)
              .values({
                name: key,
                secret: input.environmentVariables?.[key] ?? "",
              })
              .returning({ id: secrets.id });

            if (!secret[0]) {
              throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to create secret",
              });
            }

            const environmentVariable = await tx
              .insert(environmentVariables)
              .values({
                secretId: secret[0].id,
                workspaceId: input.workspaceId,
                createdBy: ctx.session.user.id,
              })
              .returning({ id: environmentVariables.id });

            if (!environmentVariable[0]) {
              throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to create environment variable",
              });
            }

            const resourceEnvironmentVariable = await tx
              .insert(resourceEnvironmentVariables)
              .values({
                resourceId: resource[0].id,
                environmentVariableId: environmentVariable[0].id,
              })
              .returning();

            if (!resourceEnvironmentVariable[0]) {
              throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to create resource environment variable",
              });
            }
          }

          return resource[0];
        } catch (error) {
          console.log(error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create resource",
          });
        }
      });

      return result;
    }),
  getAll: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      return await ctx.db.query.resources.findMany({
        where: and(
          eq(resources.workspaceId, input.workspaceId),
          eq(resources.createdBy, ctx.session.user.id),
        ),
        with: {
          integration: {
            with: {
              utils: true,
            },
          },
        },
      });
    }),
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db.query.resources.findFirst({
        where: and(
          eq(resources.id, input.id),
          eq(resources.createdBy, ctx.session.user.id),
        ),
        with: {
          integration: {
            columns: {
              type: true,
            },
          },
        },
      });

      if (!result) {
        throw new Error("Resource not found");
      }

      return result;
    }),
} satisfies TRPCRouterRecord;
