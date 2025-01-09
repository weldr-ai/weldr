import { and, eq, inArray, or } from "@integramind/db";
import { dependencies, versions } from "@integramind/db/schema";
import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure } from "../trpc";
import { isEndpointReady, isFunctionReady } from "../utils";

export const versionsRouter = {
  current: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const currentVersion = await ctx.db.query.versions.findFirst({
        where: and(
          eq(versions.projectId, input.projectId),
          eq(versions.isActive, true),
        ),
        with: {
          endpoints: {
            with: {
              endpoint: {
                with: {
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
              },
            },
          },
          funcs: {
            with: {
              func: {
                with: {
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
              },
            },
          },
        },
      });

      if (!currentVersion) {
        return {
          funcs: [],
          endpoints: [],
        };
      }

      const funcIds = currentVersion.funcs.map((f) => f.funcId);
      const endpointIds = currentVersion.endpoints.map((e) => e.endpointId);
      const queryIds = [...funcIds, ...endpointIds];
      const dependenciesResult = await ctx.db.query.dependencies.findMany({
        where: or(
          inArray(dependencies.dependentId, queryIds),
          inArray(dependencies.dependencyId, queryIds),
        ),
      });

      return {
        funcs: await Promise.all(
          currentVersion?.funcs
            .filter((data) => !data.func.isDeleted)
            .map(async (data) => {
              const {
                code,
                docs,
                integrationId,
                diff,
                isDeleted,
                isDeployed,
                ...rest
              } = data.func;
              return {
                ...rest,
                canRun: await isFunctionReady(data.func),
              };
            }) ?? [],
        ),
        endpoints: await Promise.all(
          currentVersion?.endpoints
            .filter((data) => !data.endpoint.isDeleted)
            .map(async (data) => {
              const { code, diff, isDeleted, isDeployed, ...rest } =
                data.endpoint;
              return {
                ...rest,
                canRun: await isEndpointReady(data.endpoint),
              };
            }) ?? [],
        ),
        dependencies: dependenciesResult.map((d) => ({
          id: `${d.dependentId}-${d.dependencyId}`,
          type: "smooth",
          source: d.dependentId,
          target: d.dependencyId,
        })),
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
          funcs: true,
          endpoints: true,
        },
      });

      if (!version) {
        return [];
      }

      const funcIds = version.funcs.map((f) => f.funcId);
      const endpointIds = version.endpoints.map((e) => e.endpointId);
      const queryIds = [...funcIds, ...endpointIds];
      const dependenciesResult = await ctx.db.query.dependencies.findMany({
        where: or(
          inArray(dependencies.dependentId, queryIds),
          inArray(dependencies.dependencyId, queryIds),
        ),
      });

      return dependenciesResult.map((d) => ({
        id: `${d.dependentId}-${d.dependencyId}`,
        type: "smooth",
        source: d.dependentId,
        target: d.dependencyId,
      }));
    }),
} satisfies TRPCRouterRecord;
