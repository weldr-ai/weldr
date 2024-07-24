import { eq } from "@integramind/db";
import { workspaces } from "@integramind/db/schema";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure } from "../trpc";

export const workspacesRouter = {
  create: protectedProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .insert(workspaces)
        .values({
          name: input.name,
        })
        .returning({ id: workspaces.id });

      if (!result[0]) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create workspace",
        });
      }

      return result[0];
    }),
  getAll: protectedProcedure.query(async ({ ctx, input }) => {
    const result = await ctx.db.query.workspaces.findMany();
    return result;
  }),
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db.query.workspaces.findFirst({
        where: eq(workspaces.id, input.id),
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
      await ctx.db.delete(workspaces).where(eq(workspaces.id, input.id));
    }),
};
