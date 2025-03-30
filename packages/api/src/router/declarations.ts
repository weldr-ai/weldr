import { TRPCError } from "@trpc/server";
import { and, eq } from "@weldr/db";
import { declarations } from "@weldr/db/schema";
import { z } from "zod";
import { protectedProcedure } from "../trpc";

export const declarationsRouter = {
  byId: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const declaration = await ctx.db.query.declarations.findFirst({
        where: and(
          eq(declarations.id, input.id),
          eq(declarations.userId, ctx.session.user.id),
        ),
        with: {
          canvasNode: {
            with: {
              chats: {
                limit: 1,
                orderBy: (chats, { asc }) => [asc(chats.createdAt)],
                with: {
                  messages: {
                    columns: {
                      content: false,
                    },
                    orderBy: (messages, { asc }) => [asc(messages.createdAt)],
                    with: {
                      attachments: {
                        columns: {
                          name: true,
                          key: true,
                        },
                      },
                      user: {
                        columns: {
                          name: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
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
};
