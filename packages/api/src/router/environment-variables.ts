import { eq, sql } from "@specly/db";
import { resourceEnvironmentVariables } from "@specly/db/schema";
import { TRPCError, type TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure } from "../trpc";

export const environmentVariablesRouter = {
  getByResourceId: protectedProcedure
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
              sql`select name, decrypted_secret from vault.decrypted_secrets where id=${item.environmentVariable.secretId}`,
            )
          ).rows[0];

          if (!secret) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Secret not found",
            });
          }

          return {
            key: secret.name,
            value: secret.decrypted_secret,
          } as {
            key: string;
            value: string;
          };
        }),
      );

      return environmentVariables;
    }),
} satisfies TRPCRouterRecord;
