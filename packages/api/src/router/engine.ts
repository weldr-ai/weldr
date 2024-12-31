import { and, eq, inArray, sql } from "@integramind/db";
import {
  environmentVariables,
  funcs,
  resourceEnvironmentVariables,
  resources,
  testRuns,
} from "@integramind/db/schema";
import type { Package } from "@integramind/shared/types";
import { toKebabCase } from "@integramind/shared/utils";
import { TRPCError, type TRPCRouterRecord } from "@trpc/server";
import { ofetch } from "ofetch";
import { z } from "zod";
import { protectedProcedure } from "../trpc";
import { isFunctionReady } from "../utils";

export const engineRouter = {
  executeFunc: protectedProcedure
    .input(
      z.object({
        funcId: z.string(),
        input: z.record(z.any()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const func = await ctx.db.query.funcs.findFirst({
        where: and(
          eq(funcs.id, input.funcId),
          eq(funcs.userId, ctx.session.user.id),
        ),
      });

      if (!func) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Function not found",
        });
      }

      const canRun = await isFunctionReady({ id: func.id });

      if (!canRun) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Function cannot be run",
        });
      }

      const resourceIds = func.resources?.map((resource) => resource.id);

      const packages: Package[] = func.packages ?? [];
      const modules: { path: string; content: string }[] = [];

      if (resourceIds && resourceIds.length > 0) {
        const result = await ctx.db.query.resources.findMany({
          where: inArray(resources.id, resourceIds),
          with: {
            integration: {
              with: {
                funcs: {
                  columns: {
                    name: true,
                    code: true,
                    packages: true,
                  },
                },
              },
            },
          },
        });

        for (const resource of result) {
          for (const func of resource.integration.funcs) {
            if (func.name && func.code) {
              modules.push({
                path: toKebabCase(func.name),
                content: func.code,
              });
            }
          }
        }

        for (const func of result.flatMap(
          (resource) => resource.integration.funcs,
        )) {
          packages.push(...(func.packages ?? []));
        }
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

      const requestBody = {
        functionName: func.name,
        functionArgs: input.input,
        code: func.code,
        modules,
        packages,
        environmentVariablesMap,
        testEnv:
          process.env.NODE_ENV === "development"
            ? testEnvironmentVariablesData
            : undefined,
      };

      console.log(JSON.stringify(requestBody, null, 2));

      try {
        const executionResult = await ofetch<{
          output: { stdout: string; stderr: string };
        }>("http://localhost:3003/execute/function", {
          method: "POST",
          body: JSON.stringify(requestBody),
          async onRequestError({ request, options, error }) {
            console.log(
              `[engineRouter.executeFunc] onRequestError: ${JSON.stringify(
                error,
                null,
                2,
              )}
              options: ${JSON.stringify(options, null, 2)}
              request: ${JSON.stringify(request, null, 2)}`,
            );
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to execute function",
            });
          },
          async onResponseError({ request, response, options }) {
            console.log(
              `[engineRouter.executeFunc] onResponseError: ${JSON.stringify(
                response,
                null,
                2,
              )}
              options: ${JSON.stringify(options, null, 2)}
              request: ${JSON.stringify(request, null, 2)}`,
            );
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to execute function",
            });
          },
        });

        await ctx.db.insert(testRuns).values({
          input: input.input,
          stdout: executionResult.output.stdout,
          stderr: executionResult.output.stderr,
          funcId: input.funcId,
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
} satisfies TRPCRouterRecord;
