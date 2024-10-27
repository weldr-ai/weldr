import { and, eq } from "@specly/db";
import { workspaces } from "@specly/db/schema";
import { insertWorkspaceSchema } from "@specly/shared/validators/workspaces";
import { TRPCError, type TRPCRouterRecord } from "@trpc/server";
import { ofetch } from "ofetch";
import { z } from "zod";
import { protectedProcedure } from "../trpc";

export const workspacesRouter = {
  create: protectedProcedure
    .input(insertWorkspaceSchema)
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.transaction(async (tx) => {
        const result = await tx
          .insert(workspaces)
          .values({
            name: input.name,
            subdomain: input.subdomain,
            description: input.description,
            createdBy: ctx.session.user.id,
          })
          .returning({ id: workspaces.id });

        const workspace = result[0];

        if (!workspace) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create workspace",
          });
        }

        const response = await ofetch<{ executorMachineId: string }>(
          `${process.env.ENGINE_API_URL}/api/workspaces`,
          {
            method: "POST",
            retry: 3,
            retryDelay: 1000,
            body: {
              workspaceId: workspace.id,
            },
            async onRequestError({ request, options, error }) {
              console.log("[fetch request error]", request, error);
              throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to create workspace",
              });
            },
            async onResponseError({ request, response, options }) {
              console.log("[fetch response error]", request, response);
              throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to create workspace",
              });
            },
          },
        );

        await tx
          .update(workspaces)
          .set({
            executorMachineId: response.executorMachineId,
          })
          .where(eq(workspaces.id, workspace.id));

        return workspace;
      });
    }),
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const result = await ctx.db.query.workspaces.findMany({
      where: eq(workspaces.createdBy, ctx.session.user.id),
    });
    return result;
  }),
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db.query.workspaces.findFirst({
        where: and(
          eq(workspaces.id, input.id),
          eq(workspaces.createdBy, ctx.session.user.id),
        ),
      });

      if (!result) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Workspace not found",
        });
      }

      return result;
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const response = await ofetch(
        `${process.env.ENGINE_API_URL}/api/workspaces`,
        {
          method: "DELETE",
          retry: 3,
          retryDelay: 1000,
          body: {
            workspaceId: input.id,
          },
        },
      );

      if (response.status !== 200) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete workspace",
        });
      }

      await ctx.db
        .delete(workspaces)
        .where(
          and(
            eq(workspaces.id, input.id),
            eq(workspaces.createdBy, ctx.session.user.id),
          ),
        );
    }),
} satisfies TRPCRouterRecord;
