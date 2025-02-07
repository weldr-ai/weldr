import type { TRPCRouterRecord } from "@trpc/server";
import { and, eq, inArray, isNull, or } from "@weldr/db";
import { endpoints, funcs, versions } from "@weldr/db/schema";
import { z } from "zod";
import { protectedProcedure } from "../trpc";
import { getDependencyChain, isEndpointReady, isFunctionReady } from "../utils";

export const versionsRouter = {
  current: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const currentVersion = await ctx.db.query.versions.findFirst({
        where: and(
          eq(versions.projectId, input.projectId),
          eq(versions.isActive, true),
          eq(versions.userId, ctx.session.user.id),
        ),
        with: {
          endpointDefinitions: true,
          funcDefinitions: true,
        },
      });

      if (!currentVersion) {
        return {
          funcs: [],
          endpoints: [],
        };
      }

      const funcDefinitionIds = currentVersion.funcDefinitions.map(
        (f) => f.funcDefinitionId,
      );
      const endpointDefinitionIds = currentVersion.endpointDefinitions.map(
        (e) => e.endpointDefinitionId,
      );

      const versionFuncs = await ctx.db.query.funcs.findMany({
        where: or(
          inArray(funcs.currentDefinitionId, funcDefinitionIds),
          isNull(funcs.currentDefinitionId),
        ),
        with: {
          currentDefinition: {
            columns: {
              name: true,
              inputSchema: true,
              outputSchema: true,
              rawDescription: true,
              behavior: true,
              errors: true,
              testInput: true,
            },
          },
          conversation: {
            with: {
              messages: {
                columns: {
                  id: true,
                  role: true,
                  rawContent: true,
                  createdAt: true,
                },
                orderBy: (funcsMessages, { asc }) => [
                  asc(funcsMessages.createdAt),
                ],
                with: {
                  version: {
                    columns: {
                      id: true,
                      versionName: true,
                      versionNumber: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      const versionEndpoints = await ctx.db.query.endpoints.findMany({
        where: or(
          inArray(endpoints.currentDefinitionId, endpointDefinitionIds),
          isNull(endpoints.currentDefinitionId),
        ),
        with: {
          currentDefinition: {
            columns: {
              path: true,
              method: true,
              openApiSpec: true,
            },
          },
          conversation: {
            with: {
              messages: {
                columns: {
                  content: false,
                },
                orderBy: (funcsMessages, { asc }) => [
                  asc(funcsMessages.createdAt),
                ],
                with: {
                  version: {
                    columns: {
                      id: true,
                      versionName: true,
                      versionNumber: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      const primitiveIds = [...funcDefinitionIds, ...endpointDefinitionIds];
      const dependencyChain = await getDependencyChain(ctx.db, primitiveIds);

      return {
        funcs: await Promise.all(
          versionFuncs.map(async (data) => {
            const { currentDefinitionId, currentDefinition, ...rest } = data;
            return {
              ...rest,
              ...currentDefinition,
              canRun: await isFunctionReady(data),
            };
          }) ?? [],
        ),
        endpoints: await Promise.all(
          versionEndpoints.map(async (data) => {
            const { currentDefinitionId, currentDefinition, ...rest } = data;
            return {
              ...rest,
              ...currentDefinition,
              canRun: await isEndpointReady(data),
            };
          }) ?? [],
        ),
        dependencyChain,
      };
    }),
  dependencies: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const version = await ctx.db.query.versions.findFirst({
        where: and(
          eq(versions.projectId, input.projectId),
          eq(versions.isActive, true),
        ),
        with: {
          funcDefinitions: true,
          endpointDefinitions: true,
        },
      });

      if (!version) {
        return [];
      }

      const funcDefinitionIds = version.funcDefinitions.map(
        (f) => f.funcDefinitionId,
      );
      const endpointDefinitionIds = version.endpointDefinitions.map(
        (e) => e.endpointDefinitionId,
      );
      const primitiveIds = [...funcDefinitionIds, ...endpointDefinitionIds];
      const dependencyChain = await getDependencyChain(ctx.db, primitiveIds);

      return dependencyChain;
    }),
} satisfies TRPCRouterRecord;
