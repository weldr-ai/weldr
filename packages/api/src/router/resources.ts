import { and, db, eq, sql } from "@integramind/db";
import {
  environmentVariables,
  integrations,
  projects,
  resourceEnvironmentVariables,
  resources,
} from "@integramind/db/schema";
import {
  getDatabaseStructure,
  testConnection,
} from "@integramind/shared/integrations/postgres";
import type { DbConfig } from "@integramind/shared/integrations/postgres/types";
import {
  insertResourceSchema,
  updateResourceSchema,
} from "@integramind/shared/validators/resources";
import { TRPCError, type TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure } from "../trpc";

export const resourcesRouter = {
  create: protectedProcedure
    .input(insertResourceSchema)
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.db.query.projects.findFirst({
        where: eq(projects.id, input.projectId),
      });

      if (!project) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Project not found",
        });
      }

      const integration = await ctx.db.query.integrations.findFirst({
        where: eq(integrations.id, input.integrationId),
      });

      const environment: {
        id: string;
        mapTo: string;
        userKey: string;
        value: string;
      }[] = [];

      for (const env of input.environmentVariables ?? []) {
        const environmentVariable =
          await ctx.db.query.environmentVariables.findFirst({
            where: eq(environmentVariables.key, env.userKey),
          });

        if (!environmentVariable) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Environment variable not found",
          });
        }

        const secret = (
          await db.execute(
            sql`select decrypted_secret from vault.decrypted_secrets where id=${environmentVariable.secretId}`,
          )
        ).rows[0]?.decrypted_secret as string;

        if (!secret) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Environment variable not found",
          });
        }

        environment.push({
          id: environmentVariable.id,
          userKey: environmentVariable.key,
          mapTo: env.mapTo,
          value: secret,
        });
      }

      switch (integration?.type) {
        case "postgres": {
          const connectionTest = await testConnection({
            host:
              environment.find((env) => env.mapTo === "POSTGRES_HOST")?.value ??
              "",
            port: Number.parseInt(
              environment.find((env) => env.mapTo === "POSTGRES_PORT")?.value ??
                "5432",
            ),
            database:
              environment.find((env) => env.mapTo === "POSTGRES_DB")?.value ??
              "",
            user:
              environment.find((env) => env.mapTo === "POSTGRES_USER")?.value ??
              "",
            password:
              environment.find((env) => env.mapTo === "POSTGRES_PASSWORD")
                ?.value ?? "",
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
          eq(resources.projectId, input.projectId),
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
              projectId: input.projectId,
              userId: ctx.session.user.id,
              integrationId: input.integrationId,
            })
            .returning({ id: resources.id })
            .then(([resource]) => resource);

          if (!resource) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create resource",
            });
          }

          for (const env of environment) {
            const resourceEnvironmentVariable = await tx
              .insert(resourceEnvironmentVariables)
              .values({
                mapTo: env.mapTo,
                resourceId: resource.id,
                environmentVariableId: env.id,
              })
              .returning()
              .then(
                ([resourceEnvironmentVariable]) => resourceEnvironmentVariable,
              );

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
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      return await ctx.db.query.resources.findMany({
        where: and(
          eq(resources.projectId, input.projectId),
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
  update: protectedProcedure
    .input(updateResourceSchema)
    .mutation(async ({ ctx, input }) => {
      const resource = await ctx.db.query.resources.findFirst({
        where: and(
          eq(resources.id, input.where.id),
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

      if (!resource) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Resource not found",
        });
      }

      const currentSecrets: {
        userKey: string;
        mapTo: string;
        value: string;
      }[] = [];

      const currentResourceEnvironmentVariables =
        await ctx.db.query.resourceEnvironmentVariables.findMany({
          where: eq(resourceEnvironmentVariables.resourceId, resource.id),
          with: {
            environmentVariable: true,
          },
        });

      for (const rev of currentResourceEnvironmentVariables) {
        const secret = (
          await db.execute(
            sql`select decrypted_secret from vault.decrypted_secrets where id=${rev.environmentVariable.secretId}`,
          )
        ).rows[0]?.decrypted_secret as string;

        if (!secret) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Environment variable not found",
          });
        }

        currentSecrets.push({
          userKey: rev.environmentVariable.key,
          mapTo: rev.mapTo,
          value: secret,
        });
      }

      const updatedSecrets: {
        userKey: string;
        mapTo: string;
        value: string;
      }[] = [];

      for (const env of input.payload.environmentVariables ?? []) {
        const environmentVariable =
          await ctx.db.query.environmentVariables.findFirst({
            where: eq(environmentVariables.key, env.userKey),
          });

        if (!environmentVariable) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Environment variable not found",
          });
        }

        const secret = (
          await db.execute(
            sql`select decrypted_secret from vault.decrypted_secrets where id=${environmentVariable.secretId}`,
          )
        ).rows[0]?.decrypted_secret as string;

        if (!secret) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Environment variable not found",
          });
        }

        updatedSecrets.push({
          userKey: environmentVariable.key,
          mapTo: env.mapTo,
          value: secret,
        });
      }

      const newEnvironment = currentSecrets.map((secret) => {
        const updated = updatedSecrets.find((s) => s.mapTo === secret.mapTo);
        return updated ?? secret;
      });

      if (input.payload.environmentVariables) {
        switch (resource.integration.type) {
          case "postgres": {
            const connectionTest = await testConnection({
              host:
                newEnvironment.find((env) => env.mapTo === "POSTGRES_HOST")
                  ?.value ?? "",
              port: Number.parseInt(
                newEnvironment.find((env) => env.mapTo === "POSTGRES_PORT")
                  ?.value ?? "5432",
              ),
              database:
                newEnvironment.find((env) => env.mapTo === "POSTGRES_DB")
                  ?.value ?? "",
              user:
                newEnvironment.find((env) => env.mapTo === "POSTGRES_USER")
                  ?.value ?? "",
              password:
                newEnvironment.find((env) => env.mapTo === "POSTGRES_PASSWORD")
                  ?.value ?? "",
            });

            if (!connectionTest) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: "Failed to connect to the database",
              });
            }
          }
        }
      }

      const result = await ctx.db
        .update(resources)
        .set({
          name: input.payload.name,
          description: input.payload.description,
        })
        .where(eq(resources.id, input.where.id));

      return result;
    }),
  listWithMetadata: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const resourcesResult = await ctx.db.query.resources.findMany({
        where: and(
          eq(resources.projectId, input.projectId),
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

      const resourcesWithMetadata: ((typeof resourcesResult)[number] & {
        metadata: unknown;
      })[] = [];

      for (const resource of resourcesResult) {
        const temp = {
          ...resource,
          metadata: {},
        };

        switch (resource.integration.type) {
          case "postgres": {
            const resourceEnvironmentVariablesRes =
              await ctx.db.query.resourceEnvironmentVariables.findMany({
                where: eq(resourceEnvironmentVariables.resourceId, resource.id),
                with: {
                  environmentVariable: true,
                },
              });

            const environmentVariables = await Promise.all(
              resourceEnvironmentVariablesRes.map(async (item) => {
                const secret = (
                  await ctx.db.execute(
                    sql`select decrypted_secret from vault.decrypted_secrets where id=${item.environmentVariable.secretId}`,
                  )
                ).rows[0];

                if (!secret) {
                  throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Secret not found",
                  });
                }

                return {
                  key: item.environmentVariable.key,
                  value: secret.decrypted_secret,
                } as {
                  key: string;
                  value: string;
                };
              }),
            );

            const config = environmentVariables.reduce(
              (
                acc: DbConfig,
                { key, value }: { key: string; value: string },
              ) => {
                const mapping: Record<string, keyof typeof acc> = {
                  POSTGRES_HOST: "host",
                  POSTGRES_PORT: "port",
                  POSTGRES_DB: "database",
                  POSTGRES_USER: "user",
                  POSTGRES_PASSWORD: "password",
                };
                // @ts-ignore
                acc[mapping[key]] = value;
                return acc;
              },
              {} as DbConfig,
            );

            const databaseStructure = await getDatabaseStructure(config);
            temp.metadata = databaseStructure;
            break;
          }
        }

        resourcesWithMetadata.push(temp);
      }

      return resourcesWithMetadata;
    }),
} satisfies TRPCRouterRecord;
