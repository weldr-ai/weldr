import { eq, inArray } from "@integramind/db";
import {
  integrationUtils,
  primitives,
  resources,
  testRuns,
} from "@integramind/db/schema";
import { TRPCError, type TRPCRouterRecord } from "@trpc/server";
import { ofetch } from "ofetch";
import { z } from "zod";
import { protectedProcedure } from "../trpc";

export const engineRouter = {
  executeFunction: protectedProcedure
    .input(
      z.object({
        functionId: z.string(),
        hasInput: z.boolean(),
        input: z.record(z.any()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const functionData = await ctx.db.query.primitives.findFirst({
        where: eq(primitives.id, input.functionId),
      });

      if (!functionData) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Function not found",
        });
      }

      const name = functionData.name;

      if (!name) {
        return {
          status: "error",
          message: "Please implement your function first",
        };
      }

      const code = functionData?.metadata?.code;

      if (!code) {
        return {
          status: "error",
          message:
            "Please talk with the assistant to create the function first",
        };
      }

      const resourceIds = functionData.metadata?.resources?.map(
        (resource) => resource.id,
      );

      let dependencies: { name: string; version?: string }[] =
        functionData?.metadata?.dependencies ?? [];

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

      const utilityIds = functionData.metadata?.resources?.reduce(
        (acc, resource) => {
          return acc.concat(resource.utilities.map((utility) => utility.id));
        },
        [] as string[],
      );

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
        functionName: name,
        functionArgs: input.hasInput ? input.input : undefined,
        code,
        utilities: utilities,
        dependencies,
      };

      try {
        const executionResult = await ofetch<{
          output: Record<string, unknown>;
        }>("http://localhost:3003/", {
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
          output: executionResult ?? undefined,
          primitiveId: input.functionId,
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
