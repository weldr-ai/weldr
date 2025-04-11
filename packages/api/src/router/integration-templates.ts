import { TRPCError } from "@trpc/server";
import { db } from "@weldr/db";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";

export const integrationTemplatesRouter = createTRPCRouter({
  list: publicProcedure.query(async () => {
    return await db.query.integrationTemplates.findMany({
      columns: {
        config: false,
        llmTxt: false,
        docsUrl: false,
      },
      orderBy: (templates, { desc }) => [desc(templates.createdAt)],
    });
  }),

  byId: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const integrationTemplate = await db.query.integrationTemplates.findFirst(
        {
          where: (templates, { eq }) => eq(templates.id, input.id),
          columns: {
            config: false,
            llmTxt: false,
            docsUrl: false,
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
