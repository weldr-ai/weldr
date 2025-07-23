import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@weldr/db";
import {
  environmentVariables,
  integrationEnvironmentVariables,
  integrations,
  integrationTemplates,
  projects,
} from "@weldr/db/schema";
import {
  createIntegrationSchema,
  updateIntegrationSchema,
} from "@weldr/shared/validators/integrations";
import { createTRPCRouter, protectedProcedure } from "../init";

export const integrationsRouter = createTRPCRouter({
  install: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        triggerWorkflow: z.boolean().optional().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const project = await db.query.projects.findFirst({
        where: and(
          eq(projects.id, input.projectId),
          eq(projects.userId, ctx.session.user.id),
        ),
      });

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      let url = "http://localhost:8080";

      if (process.env.NODE_ENV === "production") {
        const { Fly } = await import("@weldr/shared/fly");
        const devMachineId = await Fly.machine.getDevMachineId({
          projectId: input.projectId,
        });
        url = `http://${devMachineId}.vm.development-app-${input.projectId}.internal:8080`;
      }

      // Create headers object, preserving original headers but updating origin-related ones
      const headers = new Headers();

      // Copy all headers from the original request except origin-related ones
      ctx.headers.forEach((value, key) => {
        if (!["host", "origin", "referer"].includes(key.toLowerCase())) {
          headers.set(key, value);
        }
      });

      // Set the new origin and host for the destination
      headers.set("host", "localhost:8080");
      headers.set("origin", url);
      headers.set("content-type", "application/json");

      const response = await fetch(
        `${url}/projects/${input.projectId}/integrations/install`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            projectId: input.projectId,
            triggerWorkflow: input.triggerWorkflow,
          }),
        },
      );

      if (!response.ok) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to trigger installation",
        });
      }

      return await response.json();
    }),
  create: protectedProcedure
    .input(createIntegrationSchema)
    .mutation(async ({ ctx, input }) => {
      await db.transaction(async (tx) => {
        const {
          name,
          projectId,
          integrationTemplateId,
          environmentVariableMappings,
        } = input;

        const doesIntegrationExist = await tx.query.integrations.findFirst({
          where: and(
            eq(integrations.projectId, projectId),
            eq(integrations.userId, ctx.session.user.id),
            eq(integrations.integrationTemplateId, integrationTemplateId),
          ),
        });

        if (doesIntegrationExist) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Integration already exists",
          });
        }

        const integrationTemplate =
          await tx.query.integrationTemplates.findFirst({
            where: eq(integrationTemplates.id, integrationTemplateId),
          });

        if (!integrationTemplate) {
          console.error(
            `[integrations.create:${projectId}] Failed to find integration template`,
          );
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Failed to create integration",
          });
        }

        const [integration] = await tx
          .insert(integrations)
          .values({
            category: integrationTemplate.category,
            key: integrationTemplate.key,
            name,
            projectId,
            userId: ctx.session.user.id,
            integrationTemplateId,
            status: "queued", // User has provided config via API, ready for queue processing
          })
          .returning();

        if (!integration) {
          console.error(
            `[integrations.create:${projectId}] Failed to create integration`,
          );
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create integration",
          });
        }

        const integrationVariables = (integrationTemplate.variables ?? []).map(
          (v) => v.name,
        );

        for (const mapping of environmentVariableMappings) {
          const envVarKey = await tx.query.environmentVariables.findFirst({
            where: eq(environmentVariables.id, mapping.envVarId),
          });

          if (!envVarKey) {
            console.error(
              `[integrations.create:${projectId}] Failed to find environment variable`,
            );
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Failed to create integration",
            });
          }

          if (
            !integrationVariables.includes(
              envVarKey.key as (typeof integrationVariables)[number],
            )
          ) {
            console.error(
              `[plugins.create:${projectId}] Environment variable not in config`,
            );
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Failed to create integration",
            });
          }

          await tx.insert(integrationEnvironmentVariables).values({
            integrationId: integration.id,
            mapTo: mapping.configKey,
            environmentVariableId: envVarKey.id,
          });
        }

        return integration;
      });

      try {
        await integrationsRouter.createCaller(ctx).install({
          projectId: input.projectId,
        });

        console.log(
          `[integrations.create:${input.projectId}] Installation triggered successfully`,
        );
      } catch (error) {
        console.error(
          `[integrations.create:${input.projectId}] Failed to trigger installation:`,
          error,
        );
      }
    }),
  byId: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const integration = await db.query.integrations.findFirst({
        where: and(
          eq(integrations.id, input.id),
          eq(integrations.userId, ctx.session.user.id),
        ),
        columns: {
          id: true,
          name: true,
          category: true,
          key: true,
          status: true,
        },
        with: {
          environmentVariableMappings: {
            columns: {
              environmentVariableId: true,
              mapTo: true,
            },
          },
          integrationTemplate: {
            columns: {
              id: true,
              name: true,
              description: true,
              category: true,
              key: true,
            },
          },
        },
      });

      if (!integration) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Integration not found",
        });
      }

      return integration;
    }),
  list: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { projectId } = input;

      const items = await db.query.integrations.findMany({
        where: and(
          eq(integrations.projectId, projectId),
          eq(integrations.userId, ctx.session.user.id),
        ),
        columns: {
          id: true,
          name: true,
          key: true,
          status: true,
        },
        with: {
          environmentVariableMappings: {
            columns: {
              environmentVariableId: true,
              mapTo: true,
            },
          },
          integrationTemplate: {
            columns: {
              id: true,
              name: true,
              description: true,
              category: true,
              key: true,
            },
          },
        },
        orderBy: desc(integrations.id),
      });

      return items;
    }),
  update: protectedProcedure
    .input(updateIntegrationSchema)
    .mutation(async ({ ctx, input }) => {
      await db.transaction(async (tx) => {
        const existingIntegration = await tx.query.integrations.findFirst({
          where: and(
            eq(integrations.id, input.where.id),
            eq(integrations.userId, ctx.session.user.id),
          ),
        });

        if (!existingIntegration) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Integration not found",
          });
        }

        const [updatedIntegration] = await tx
          .update(integrations)
          .set({
            name: input.payload.name ?? existingIntegration.name,
          })
          .where(eq(integrations.id, input.where.id))
          .returning();

        if (!updatedIntegration) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to update integration",
          });
        }

        if (input.payload.environmentVariableMappings) {
          for (const mapping of input.payload.environmentVariableMappings) {
            const envVarKey = await tx.query.environmentVariables.findFirst({
              where: eq(environmentVariables.id, mapping.envVarId),
            });

            if (!envVarKey) {
              console.error(
                `[integrations.update:${input.where.id}] Failed to find environment variable`,
              );
              throw new TRPCError({
                code: "NOT_FOUND",
                message: "Failed to update integration",
              });
            }

            await tx
              .insert(integrationEnvironmentVariables)
              .values({
                mapTo: mapping.configKey,
                environmentVariableId: envVarKey.id,
                integrationId: input.where.id,
              })
              .onConflictDoUpdate({
                target: [
                  integrationEnvironmentVariables.integrationId,
                  integrationEnvironmentVariables.environmentVariableId,
                  integrationEnvironmentVariables.mapTo,
                ],
                set: {
                  mapTo: mapping.configKey,
                },
              });
          }
        }

        return updatedIntegration;
      });
    }),
});
