import { and, eq, inArray, sql } from "@integramind/db";
import {
  environmentVariables,
  flows,
  integrationUtils,
  primitives,
  resourceEnvironmentVariables,
  resources,
  testRuns,
} from "@integramind/db/schema";
import type { Dependency, Primitive } from "@integramind/shared/types";
import { TRPCError, type TRPCRouterRecord } from "@trpc/server";
import { ofetch } from "ofetch";
import { z } from "zod";
import { protectedProcedure } from "../trpc";
import { canRunPrimitive } from "../utils";

export const engineRouter = {
  executePrimitive: protectedProcedure
    .input(
      z.object({
        primitiveId: z.string(),
        hasInput: z.boolean(),
        input: z.record(z.any()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const primitive = (await ctx.db.query.primitives.findFirst({
        where: and(
          eq(primitives.id, input.primitiveId),
          eq(primitives.userId, ctx.session.user.id),
        ),
      })) as Omit<Primitive, "testRuns" | "conversation"> | undefined;

      if (!primitive) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Primitive not found",
        });
      }

      const canRun = canRunPrimitive(primitive as Primitive);

      if (!canRun) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Primitive cannot be run",
        });
      }

      const resourceIds = primitive.resources?.map((resource) => resource.id);

      let dependencies: Dependency[] = primitive.dependencies ?? [];

      if (resourceIds && resourceIds.length > 0) {
        const result = await ctx.db.query.resources.findMany({
          where: inArray(resources.id, resourceIds),
          with: {
            integration: {
              columns: {
                dependencies: true,
              },
            },
          },
        });

        dependencies = dependencies.concat(
          result.flatMap((resource) => resource.integration.dependencies ?? []),
        );
      }

      const environmentVariablesMap: Record<string, string> = {};

      // Add environment variables when running locally
      const testEnvironmentVariablesData: {
        key: string;
        value: string;
      }[] = [];

      for (const resourceId of resourceIds ?? []) {
        const resourceEnvironmentVariablesData =
          await ctx.db.query.resourceEnvironmentVariables.findMany({
            where: eq(resourceEnvironmentVariables.resourceId, resourceId),
          });

        for (const resourceEnvironmentVariableData of resourceEnvironmentVariablesData) {
          const environmentVariableData =
            await ctx.db.query.environmentVariables.findFirst({
              where: eq(
                environmentVariables.id,
                resourceEnvironmentVariableData.environmentVariableId,
              ),
            });

          if (!environmentVariableData) {
            continue;
          }

          environmentVariablesMap[resourceEnvironmentVariableData.mapTo] =
            environmentVariableData.key;

          // Only fetch secrets in development for testing
          if (process.env.NODE_ENV === "development") {
            const secret = (
              await ctx.db.execute(
                sql`select decrypted_secret from vault.decrypted_secrets where id=${environmentVariableData.secretId}`,
              )
            ).rows[0];

            if (!secret) {
              throw new TRPCError({
                code: "NOT_FOUND",
                message: "Secret not found",
              });
            }

            testEnvironmentVariablesData.push({
              key: environmentVariableData.key,
              value: secret.decrypted_secret as string,
            });
          }
        }
      }

      const utilityIds = primitive.resources?.reduce((acc, resource) => {
        return acc.concat(
          resource.utilities?.map((utility) => utility.id) ?? [],
        );
      }, [] as string[]);

      let utilities: { filePath: string; content: string }[] = [];

      if (utilityIds && utilityIds.length > 0) {
        const utilitiesData = await ctx.db.query.integrationUtils.findMany({
          where: inArray(integrationUtils.id, utilityIds),
        });

        utilities = utilitiesData.map((utility) => ({
          filePath: utility.filePath,
          content: utility.implementation,
        }));
      }

      const requestBody = {
        hasInput: input.hasInput,
        functionName: primitive.name,
        functionArgs: input.hasInput ? input.input : undefined,
        code: primitive.code,
        utilities,
        dependencies,
        environmentVariablesMap,
        testEnv:
          process.env.NODE_ENV === "development"
            ? testEnvironmentVariablesData
            : undefined,
      };

      try {
        const executionResult = await ofetch<{
          output: { stdout: string; stderr: string };
        }>("http://localhost:3003/execute/function", {
          method: "POST",
          body: JSON.stringify(requestBody),
          async onRequestError({ request, options, error }) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to execute function",
            });
          },
          async onResponseError({ request, response, options }) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to execute function",
            });
          },
        });

        await ctx.db.insert(testRuns).values({
          input: input.hasInput ? input.input : undefined,
          stdout: executionResult.output.stdout,
          stderr: executionResult.output.stderr,
          primitiveId: input.primitiveId,
        });

        return {
          status: "success",
          output: executionResult,
        };
      } catch (error) {
        return {
          status: "error",
          message: "Failed to execute function",
        };
      }
    }),
  executeFlow: protectedProcedure
    .input(
      z.object({
        flowId: z.string(),
        request: z.object({
          body: z.unknown().optional(),
          query: z.record(z.string(), z.string()).optional(),
          params: z.record(z.string(), z.string()).optional(),
          headers: z.record(z.string(), z.string()).optional(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const flowData = await ctx.db.query.flows.findFirst({
        where: eq(flows.id, input.flowId),
      });

      if (!flowData) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Flow not found",
        });
      }
    }),
} satisfies TRPCRouterRecord;
