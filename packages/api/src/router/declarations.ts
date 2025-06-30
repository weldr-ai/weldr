import { TRPCError } from "@trpc/server";
import { and, eq } from "@weldr/db";
import { declarationIntegrations, declarations, dependencies } from "@weldr/db/schema";
import { z } from "zod";
import { protectedProcedure } from "../init";

export const declarationsRouter = {
  byId: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const declaration = await ctx.db.query.declarations.findFirst({
        where: and(
          eq(declarations.id, input.id),
          eq(declarations.userId, ctx.session.user.id),
        ),
        columns: {
          id: true,
          nodeId: true,
          specs: true,
          progress: true,
        },
        with: {
          node: true,
        },
      });

      if (!declaration) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Declaration not found",
        });
      }

      return declaration;
    }),
  
  getDependencies: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      // First verify the user owns this declaration
      const declaration = await ctx.db.query.declarations.findFirst({
        where: and(
          eq(declarations.id, input.id),
          eq(declarations.userId, ctx.session.user.id),
        ),
      });

      if (!declaration) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Declaration not found",
        });
      }

      // Get dependencies (what this declaration depends on)
      const deps = await ctx.db.query.dependencies.findMany({
        where: eq(dependencies.dependentId, input.id),
        with: {
          dependency: {
            columns: {
              id: true,
              specs: true,
            },
          },
        },
      });

      return deps.map(dep => dep.dependency);
    }),

  getIntegrations: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      // First verify the user owns this declaration
      const declaration = await ctx.db.query.declarations.findFirst({
        where: and(
          eq(declarations.id, input.id),
          eq(declarations.userId, ctx.session.user.id),
        ),
      });

      if (!declaration) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Declaration not found",
        });
      }

      // Get integrations for this declaration
      const integs = await ctx.db.query.declarationIntegrations.findMany({
        where: eq(declarationIntegrations.declarationId, input.id),
        with: {
          integration: {
            columns: {
              id: true,
              name: true,
            },
          },
        },
      });

      return integs.map(integ => integ.integration);
    }),
};
