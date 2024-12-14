import { and, eq, sql } from "@integramind/db";
import {
  environmentVariables,
  resourceEnvironmentVariables,
  secrets,
} from "@integramind/db/schema";
import { insertEnvironmentVariableSchema } from "@integramind/shared/validators/environment-variables";
import { TRPCError, type TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure } from "../trpc";

export const environmentVariablesRouter = {
  create: protectedProcedure
    .input(insertEnvironmentVariableSchema)
    .mutation(async ({ input, ctx }) => {
      const isUnique = await ctx.db.query.environmentVariables.findFirst({
        where: and(
          eq(environmentVariables.workspaceId, input.workspaceId),
          eq(environmentVariables.key, input.key),
        ),
      });

      if (isUnique) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Environment variable already exists",
        });
      }

      const environmentVariable = await ctx.db.transaction(async (tx) => {
        const secret = (
          await tx
            .insert(secrets)
            .values({
              secret: input.value,
            })
            .returning()
        )[0];

        if (!secret) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Secret not found",
          });
        }

        const environmentVariable = (
          await tx
            .insert(environmentVariables)
            .values({
              ...input,
              userId: ctx.session.user.id,
              secretId: secret.id,
            })
            .returning({
              id: environmentVariables.id,
            })
        )[0];

        return environmentVariable;
      });

      if (!environmentVariable) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Environment variable not found",
        });
      }

      return environmentVariable;
    }),
  list: protectedProcedure
    .input(z.object({ resourceId: z.string() }))
    .query(async ({ input, ctx }) => {
      return ctx.db.query.environmentVariables.findMany({
        where: eq(environmentVariables.workspaceId, input.resourceId),
        columns: {
          secretId: false,
        },
      });
    }),
  resourceEnvironmentVariables: protectedProcedure
    .input(z.object({ resourceId: z.string() }))
    .query(async ({ input, ctx }) => {
      return ctx.db.query.resourceEnvironmentVariables.findMany({
        where: eq(resourceEnvironmentVariables.resourceId, input.resourceId),
        with: {
          environmentVariable: {
            columns: {
              key: true,
            },
          },
        },
      });
    }),
  byResourceId: protectedProcedure
    .input(
      z.object({
        resourceId: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const result = await ctx.db.query.resourceEnvironmentVariables.findMany({
        where: eq(resourceEnvironmentVariables.resourceId, input.resourceId),
        with: {
          environmentVariable: true,
        },
      });

      const environmentVariables = await Promise.all(
        result.map(async (item) => {
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

      return environmentVariables;
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const environmentVariable =
        await ctx.db.query.environmentVariables.findFirst({
          where: and(
            eq(environmentVariables.id, input.id),
            eq(environmentVariables.userId, ctx.session.user.id),
          ),
        });

      if (!environmentVariable) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Environment variable not found",
        });
      }

      await ctx.db
        .delete(secrets)
        .where(eq(secrets.id, environmentVariable.secretId));

      await ctx.db
        .delete(environmentVariables)
        .where(eq(environmentVariables.id, input.id));
    }),
} satisfies TRPCRouterRecord;
