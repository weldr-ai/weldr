import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { and, desc, eq, isNotNull } from "@weldr/db";
import { chats, versions } from "@weldr/db/schema";
import { protectedProcedure } from "../init";

export const versionRouter = {
  create: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [chat] = await ctx.db
        .insert(chats)
        .values({
          userId: ctx.session.user.id,
          projectId: input.projectId,
        })
        .returning();

      if (!chat) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create version",
        });
      }

      const version = await ctx.db.insert(versions).values({
        projectId: input.projectId,
        userId: ctx.session.user.id,
        chatId: chat.id,
      });

      return version;
    }),
  current: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const version = await ctx.db.query.versions.findFirst({
        where: and(
          eq(versions.projectId, input.projectId),
          eq(versions.userId, ctx.session.user.id),
          isNotNull(versions.activatedAt),
        ),
        with: {
          declarations: {
            with: {
              declaration: {
                with: {
                  node: true,
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
        .filter((declaration) => declaration.declaration.node)
        .map((declaration) => ({
          ...declaration,
          node: declaration.declaration.node,
        }));

      return {
        number: version.number,
        id: version.id,
        createdAt: version.createdAt,
        userId: version.userId,
        projectId: version.projectId,
        message: version.message,
        activatedAt: version.activatedAt,
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
        columns: {
          id: true,
          message: true,
          createdAt: true,
          parentVersionId: true,
          number: true,
          status: true,
          description: true,
          activatedAt: true,
          projectId: true,
        },
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
            isNotNull(versions.activatedAt),
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
          .set({ activatedAt: null })
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
          .set({ activatedAt: new Date() })
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
