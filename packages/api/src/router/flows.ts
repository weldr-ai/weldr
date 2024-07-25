import { and, eq, sql } from "@integramind/db";
import {
  flowTypesSchema,
  flows,
  insertFlowSchema,
  primitives,
} from "@integramind/db/schema";
import type { RouteMetadata } from "@integramind/db/types";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure } from "../trpc";

export const flowsRouter = {
  create: protectedProcedure
    .input(insertFlowSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .insert(flows)
        .values({
          name: input.name,
          description: input.description,
          type: input.type,
          workspaceId: input.workspaceId,
          createdBy: ctx.session.user.id,
        })
        .returning({ id: flows.id });

      if (!result[0]) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create flow",
        });
      }
      return result[0];
    }),
  getAll: protectedProcedure
    .input(z.object({ workspaceId: z.string(), type: flowTypesSchema }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db.query.flows.findMany({
        where: and(
          eq(flows.workspaceId, input.workspaceId),
          eq(flows.type, input.type),
          eq(flows.createdBy, ctx.session.user.id),
        ),
      });
      return result;
    }),
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db.query.flows.findFirst({
        where: and(
          eq(flows.id, input.id),
          eq(flows.createdBy, ctx.session.user.id),
        ),
        with: {
          primitives: true,
          edges: true,
        },
      });

      if (!result) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Flow not found",
        });
      }

      return result;
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(flows)
        .where(
          and(eq(flows.id, input.id), eq(flows.createdBy, ctx.session.user.id)),
        );
    }),
  getRouteFlowByPath: protectedProcedure
    .input(
      z.object({
        urlPath: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const result = await ctx.db
        .select({
          metadata: primitives.metadata,
          flowId: primitives.flowId,
        })
        .from(primitives)
        .where(
          and(
            eq(primitives.type, "route"),
            sql`primitives.metadata::jsonb->>'urlPath' = ${input.urlPath}`,
          ),
        );

      if (!result[0]) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Flow not found",
        });
      }

      const flow = await ctx.db.query.flows.findFirst({
        where: eq(flows.id, result[0].flowId),
        with: {
          primitives: true,
          edges: true,
        },
      });

      if (!flow) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Flow not found",
        });
      }

      return {
        flow,
        config: {
          actionType: (result[0].metadata as RouteMetadata).actionType,
          urlPath: (result[0].metadata as RouteMetadata).urlPath,
          inputs: (result[0].metadata as RouteMetadata).inputs,
        },
      };
    }),
};
