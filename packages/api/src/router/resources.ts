import { and, eq, sql } from "@integramind/db";
import { resources } from "@integramind/db/schema";
import { type Table, getInfo } from "@integramind/integrations-postgres";
import { insertResourceSchema } from "@integramind/shared/validators/resources";
import { z } from "zod";
import { protectedProcedure } from "../trpc";

export const resourcesRouter = {
  create: protectedProcedure
    .input(insertResourceSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .insert(resources)
        .values({
          name: input.name,
          description: input.description,
          provider: input.provider,
          metadata: sql`${input.metadata}::jsonb`,
          workspaceId: input.workspaceId,
          createdBy: ctx.session.user.id,
        })
        .returning({ id: resources.id });

      if (!result[0]) {
        throw new Error("Failed to create resource");
      }

      return result[0];
    }),
  getAll: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db.query.resources.findMany({
        where: and(
          eq(resources.workspaceId, input.workspaceId),
          eq(resources.createdBy, ctx.session.user.id),
        ),
      });
      return result;
    }),
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db.query.resources.findFirst({
        where: and(
          eq(resources.id, input.id),
          eq(resources.createdBy, ctx.session.user.id),
        ),
      });

      if (!result) {
        throw new Error("Resource not found");
      }

      let tables: Table[] | undefined;

      if (result.provider === "postgres") {
        const auth = result.metadata;

        tables = await getInfo({
          auth: {
            host: auth.host,
            port: Number(auth.port),
            user: auth.user,
            password: auth.password,
            database: auth.database,
          },
        });
      }

      return {
        ...result,
        metadata: {
          ...result.metadata,
          tables: tables ?? [],
        },
      };
    }),
};
