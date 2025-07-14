import { TRPCError } from "@trpc/server";
import { db } from "@weldr/db";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../init";

export const integrationTemplatesRouter = createTRPCRouter({
  list: publicProcedure.query(async () => {
    return await db.query.integrationTemplates.findMany({
      orderBy: (templates, { desc }) => [desc(templates.createdAt)],
      with: {
        variables: {
          orderBy: (variables, { asc }) => [asc(variables.name)],
        },
      },
    });
  }),
  byId: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const integrationTemplate = await db.query.integrationTemplates.findFirst(
        {
          where: (templates, { eq }) => eq(templates.id, input.id),
          with: {
            variables: {
              orderBy: (variables, { asc }) => [asc(variables.name)],
            },
          },
        },
      );

      if (!integrationTemplate) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Integration template not found",
        });
      }

      return integrationTemplate;
    }),
});
