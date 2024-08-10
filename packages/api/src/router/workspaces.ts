import { and, eq } from "@integramind/db";
import { workspaces } from "@integramind/db/schema";
import { FlyClient } from "@integramind/deployer";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure } from "../trpc";

export const workspacesRouter = {
  create: protectedProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.transaction(async (tx) => {
        const result = await tx
          .insert(workspaces)
          .values({
            name: input.name,
            createdBy: ctx.session.user.id,
          })
          .returning({ id: workspaces.id });

        if (!result[0]) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create workspace",
          });
        }

        // Attempt to create the Fly app with retry logic
        await FlyClient.createFlyAppWithRetry(result[0].id);

        return result[0];
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
      await ctx.db
        .delete(workspaces)
        .where(
          and(
            eq(workspaces.id, input.id),
            eq(workspaces.createdBy, ctx.session.user.id),
          ),
        );
    }),
};
