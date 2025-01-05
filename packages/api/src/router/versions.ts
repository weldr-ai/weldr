import { and, eq, inArray, or } from "@integramind/db";
import {
  dependencies,
  versionEndpoints,
  versionFuncs,
  versions,
} from "@integramind/db/schema";
import { insertVersionSchema } from "@integramind/shared/validators/versions";
import { TRPCError, type TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure } from "../trpc";
import { isEndpointReady, isFunctionReady } from "../utils";

export const versionsRouter = {
  create: protectedProcedure
    .input(insertVersionSchema)
    .mutation(async ({ ctx, input }) => {
      const newVersion = await ctx.db.transaction(async (tx) => {
        // Create new project version
        const currentVersion = await tx.query.versions.findFirst({
          where: and(
            eq(versions.projectId, input.projectId),
            eq(versions.isCurrent, true),
          ),
          with: {
            funcs: true,
            endpoints: true,
          },
        });

        if (!currentVersion) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Current version not found",
          });
        }

        const newVersion = (
          await tx
            .insert(versions)
            .values({
              projectId: input.projectId,
              isCurrent: true,
              versionName: input.versionName,
              versionNumber: 1,
              userId: ctx.session.user.id,
              parentVersionId: currentVersion.id,
              messageId: input.messageId,
            })
            .returning()
        )[0];

        if (!newVersion) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create new version",
          });
        }

        const filteredFuncs = currentVersion.funcs
          .filter((func) => !input.deletedFuncIds?.includes(func.funcId))
          .map((func) => func.funcId);

        const filteredEndpoints = currentVersion.endpoints
          .filter(
            (endpoint) =>
              !input.deletedEndpointIds?.includes(endpoint.endpointId),
          )
          .map((endpoint) => endpoint.endpointId);

        for (const funcId of [
          ...filteredFuncs,
          ...(input.addedFuncIds ?? []),
        ]) {
          await tx.insert(versionFuncs).values({
            funcId,
            versionId: newVersion.id,
          });
        }

        for (const endpointId of [
          ...filteredEndpoints,
          ...(input.addedEndpointIds ?? []),
        ]) {
          await tx.insert(versionEndpoints).values({
            endpointId,
            versionId: newVersion.id,
          });
        }

        return newVersion;
      });

      return newVersion;
    }),
  current: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const currentVersion = await ctx.db.query.versions.findFirst({
        where: and(
          eq(versions.projectId, input.projectId),
          eq(versions.isCurrent, true),
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
          currentVersion?.funcs.map(async (data) => {
            const { code, packages, docs, resources, integrationId, ...rest } =
              data.func;
            return {
              ...rest,
              canRun: await isFunctionReady(data.func),
            };
          }) ?? [],
        ),
        endpoints: await Promise.all(
          currentVersion?.endpoints.map(async (data) => {
            const { code, packages, resources, ...rest } = data.endpoint;
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
          eq(versions.isCurrent, true),
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
