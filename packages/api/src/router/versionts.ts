import { TRPCError } from "@trpc/server";
import { and, eq } from "@weldr/db";
import { versions } from "@weldr/db/schema";
import { z } from "zod";
import { protectedProcedure } from "../trpc";

export const versionRouter = {
  current: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const version = await ctx.db.query.versions.findFirst({
        where: and(
          eq(versions.projectId, input.projectId),
          eq(versions.userId, ctx.session.user.id),
          eq(versions.isCurrent, true),
        ),
        with: {
          declarations: {
            with: {
              declaration: {
                with: {
                  canvasNode: true,
                },
              },
            },
          },
        },
      });

      if (!version) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Version not found",
        });
      }

      const declarations = version.declarations
        .filter((declaration) => declaration.declaration.canvasNode)
        .map((declaration) => ({
          ...declaration,
          canvasNode: declaration.declaration.canvasNode,
        }));

      return {
        number: version.number,
        id: version.id,
        createdAt: version.createdAt,
        userId: version.userId,
        projectId: version.projectId,
        message: version.message,
        machineId: version.machineId,
        isCurrent: version.isCurrent,
        parentVersionId: version.parentVersionId,
        declarations,
      };
    }),
};
