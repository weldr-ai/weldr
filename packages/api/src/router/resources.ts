import { and, eq } from "@specly/db";
import { resources } from "@specly/db/schema";
import { type Table, getInfo } from "@specly/integrations-postgres";
import { insertResourceSchema as _insertResourceSchema } from "@specly/shared/validators/resources";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure } from "../trpc";

const insertResourceSchema = _insertResourceSchema.transform((data) => {
  if (data.provider === "postgres" || data.provider === "mysql") {
    return {
      ...data,
      metadata: {
        ...data.metadata,
        port: Number(data.metadata.port),
      },
    };
  }
  return data;
});

export const resourcesRouter = {
  create: protectedProcedure
    .input(insertResourceSchema)
    .mutation(async ({ ctx, input }) => {
      const doesExist = await ctx.db.query.resources.findFirst({
        where: and(
          eq(resources.name, input.name),
          eq(resources.workspaceId, input.workspaceId),
        ),
      });

      if (doesExist) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Resource name must be unique",
        });
      }

      const result = await ctx.db
        .insert(resources)
        .values({
          name: input.name,
          description: input.description,
          workspaceId: input.workspaceId,
          createdBy: ctx.session.user.id,
          provider: input.provider,
          metadata: input.metadata,
        })
        .returning({ id: resources.id });

      if (!result[0]) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create resource",
        });
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
