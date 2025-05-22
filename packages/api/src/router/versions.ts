import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "@weldr/db";
import { versions } from "@weldr/db/schema";
import { z } from "zod";
import { protectedProcedure } from "../init";

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
  list: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const versionsList = await ctx.db.query.versions.findMany({
        where: eq(versions.projectId, input.projectId),
        orderBy: desc(versions.createdAt),
      });
      return versionsList;
    }),
  setCurrent: protectedProcedure
    .input(z.object({ versionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.transaction(async (tx) => {
        const previousCurrentVersion = await tx.query.versions.findFirst({
          where: and(
            eq(versions.userId, ctx.session.user.id),
            eq(versions.isCurrent, true),
          ),
          columns: {
            id: true,
          },
        });

        if (!previousCurrentVersion) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Current version not found",
          });
        }

        const [previousCurrentVersionUpdate] = await tx
          .update(versions)
          .set({ isCurrent: false })
          .where(eq(versions.id, previousCurrentVersion.id))
          .returning();

        if (!previousCurrentVersionUpdate) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Previous current version not found",
          });
        }

        const [newCurrentVersion] = await tx
          .update(versions)
          .set({ isCurrent: true })
          .where(eq(versions.id, input.versionId))
          .returning();

        if (!newCurrentVersion) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "New current version not found",
          });
        }

        return {
          previousCurrentVersion: previousCurrentVersionUpdate,
          newCurrentVersion,
        };
      });
    }),
};
