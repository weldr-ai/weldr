import { and, eq } from "@integramind/db";
import {
  environmentVariables,
  integrations,
  resourceEnvironmentVariables,
  resources,
  secrets,
  workspaces,
} from "@integramind/db/schema";
import { testConnection } from "@integramind/shared/integrations/postgres/helpers";
import { insertResourceSchema } from "@integramind/shared/validators/resources";
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
            host:
              input.environmentVariables?.find(
                (env) => env.mappedKey === "POSTGRES_HOST",
              )?.value ?? "",
            port: Number.parseInt(
              input.environmentVariables?.find(
                (env) => env.mappedKey === "POSTGRES_PORT",
              )?.value ?? "5432",
            ),
            database:
              input.environmentVariables?.find(
                (env) => env.mappedKey === "POSTGRES_DB",
              )?.value ?? "",
            user:
              input.environmentVariables?.find(
                (env) => env.mappedKey === "POSTGRES_USER",
              )?.value ?? "",
            password:
              input.environmentVariables?.find(
                (env) => env.mappedKey === "POSTGRES_PASSWORD",
              )?.value ?? "",
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
          const resource = (
            await tx
              .insert(resources)
              .values({
                name: input.name,
                description: input.description,
                workspaceId: input.workspaceId,
                userId: ctx.session.user.id,
                integrationId: input.integrationId,
              })
              .returning({ id: resources.id })
          )[0];

          if (!resource) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create resource",
            });
          }

          for (const env of input.environmentVariables ?? []) {
            const secret = (
              await tx
                .insert(secrets)
                .values({
                  secret: env.value,
                })
                .returning({ id: secrets.id })
            )[0];

            if (!secret) {
              throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to create resource",
              });
            }

            const environmentVariable = (
              await tx
                .insert(environmentVariables)
                .values({
                  key: env.key,
                  secretId: secret.id,
                  workspaceId: input.workspaceId,
                  userId: ctx.session.user.id,
                })
                .returning({ id: environmentVariables.id })
            )[0];

            if (!environmentVariable) {
              throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to create resource",
              });
            }

            const resourceEnvironmentVariable = (
              await tx
                .insert(resourceEnvironmentVariables)
                .values({
                  mappedKey: env.mappedKey,
                  resourceId: resource.id,
                  environmentVariableId: environmentVariable.id,
                })
                .returning()
            )[0];

            if (!resourceEnvironmentVariable) {
              throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to create resource",
              });
            }
          }

          return resource;
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
  list: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      return await ctx.db.query.resources.findMany({
        where: and(
          eq(resources.workspaceId, input.workspaceId),
          eq(resources.userId, ctx.session.user.id),
        ),
        columns: {
          id: true,
          name: true,
          description: true,
        },
        with: {
          integration: {
            columns: {
              id: true,
              name: true,
              description: true,
              type: true,
            },
          },
        },
      });
    }),
  byId: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db.query.resources.findFirst({
        where: and(
          eq(resources.id, input.id),
          eq(resources.userId, ctx.session.user.id),
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
