import { TRPCError, type TRPCRouterRecord } from "@trpc/server";

import {
  conversationMessages,
  conversations,
  funcVersions,
  funcs,
} from "@integramind/db/schema";

import { and, eq, gt } from "@integramind/db";
import type {
  JsonSchema,
  Package,
  RawContent,
  RequirementResource,
} from "@integramind/shared/types";
import {
  createNewFuncVersionSchema,
  insertFuncSchema,
  updateFuncSchema,
} from "@integramind/shared/validators/funcs";
import { z } from "zod";
import { protectedProcedure } from "../trpc";
import {
  generateFuncVersionHash,
  hasDependencyMismatch,
  isFunctionReady,
  isMissingDependencies,
} from "../utils";

export const funcsRouter = {
  create: protectedProcedure
    .input(insertFuncSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await ctx.db.transaction(async (tx) => {
          const conversation = (
            await tx
              .insert(conversations)
              .values({
                userId: ctx.session.user.id,
              })
              .returning()
          )[0];

          if (!conversation) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create conversation",
            });
          }

          const result = await tx
            .insert(funcs)
            .values({
              ...input,
              userId: ctx.session.user.id,
              conversationId: conversation?.id,
            })
            .returning();

          if (!result[0]) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create function",
            });
          }

          return {
            ...result[0],
            conversationId: conversation.id,
            conversation: {
              ...conversation,
              messages: [],
            },
          };
        });

        const { integrationId, ...rest } = result;
        return {
          ...rest,
          canRun: await isFunctionReady({ id: result.id }),
        };
      } catch (error) {
        console.error(error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create function",
        });
      }
    }),
  byId: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        const result = await ctx.db.query.funcs.findFirst({
          where: and(
            eq(funcs.id, input.id),
            eq(funcs.userId, ctx.session.user.id),
          ),
          with: {
            currentVersion: true,
            conversation: {
              with: {
                messages: {
                  columns: {
                    id: true,
                    role: true,
                    rawContent: true,
                    createdAt: true,
                  },
                  orderBy: (funcsMessages, { asc }) => [
                    asc(funcsMessages.createdAt),
                  ],
                  with: {
                    funcVersion: {
                      columns: {
                        id: true,
                        versionTitle: true,
                        versionNumber: true,
                      },
                    },
                  },
                },
              },
            },
          },
        });

        if (!result) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Function not found",
          });
        }

        const { currentVersion, ...rest } = result;
        const {
          id,
          code,
          packages,
          docs,
          resources,
          hash,
          ...currentVersionRest
        } = currentVersion ?? {};

        return {
          ...rest,
          ...currentVersionRest,
          canRun: await isFunctionReady({ id: result.id }),
        };
      } catch (error) {
        console.error(error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get function",
        });
      }
    }),
  update: protectedProcedure
    .input(updateFuncSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const func = await ctx.db.query.funcs.findFirst({
          where: and(
            eq(funcs.id, input.where.id),
            eq(funcs.userId, ctx.session.user.id),
          ),
        });

        if (!func) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Function not found",
          });
        }

        const updatedFunc = await ctx.db.transaction(async (tx) => {
          const updatedFunc = (
            await tx
              .update(funcs)
              .set(input.payload)
              .where(eq(funcs.id, func.id))
              .returning()
          )[0];

          if (!updatedFunc) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to update function",
            });
          }

          const { integrationId, ...updatedFuncRest } = updatedFunc;

          if (input.payload.testInput) {
            if (!func.currentVersionId) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: "Function is not implemented yet",
              });
            }

            const updatedVersion = (
              await tx
                .update(funcVersions)
                .set({
                  testInput: input.payload.testInput,
                })
                .where(eq(funcVersions.funcId, func.currentVersionId))
                .returning()
            )[0];

            if (!updatedVersion) {
              throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to update function",
              });
            }

            const {
              code,
              packages,
              docs,
              resources,
              hash,
              ...updatedVersionRest
            } = updatedVersion ?? {};

            return {
              ...updatedFuncRest,
              ...updatedVersionRest,
              canRun: await isFunctionReady({ id: func.id }),
            };
          }

          return {
            ...updatedFuncRest,
            canRun: await isFunctionReady({ id: func.id }),
          };
        });

        return updatedFunc;
      } catch (error) {
        console.error(error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update function",
        });
      }
    }),
  createNewVersion: protectedProcedure
    .input(createNewFuncVersionSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const existingFunc = await ctx.db.query.funcs.findFirst({
          where: and(
            eq(funcs.id, input.where.id),
            eq(funcs.userId, ctx.session.user.id),
          ),
          with: {
            currentVersion: true,
          },
        });

        if (
          !existingFunc ||
          !existingFunc.projectId ||
          !existingFunc.conversationId
        ) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Function not found",
          });
        }

        if (input.payload.name && existingFunc.projectId) {
          const isUnique =
            (await ctx.db.query.funcs.findFirst({
              where: and(
                eq(funcs.name, input.payload.name),
                eq(funcs.projectId, existingFunc.projectId),
              ),
            })) !== undefined;

          if (isUnique && existingFunc.id !== input.where.id) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Function name already exists",
            });
          }
        }

        const newVersion = await ctx.db.transaction(async (tx) => {
          const versionData = {
            name: (input.payload.name ??
              existingFunc.currentVersion?.name) as string,
            inputSchema: (input.payload.inputSchema ??
              existingFunc.currentVersion?.inputSchema) as JsonSchema,
            outputSchema: (input.payload.outputSchema ??
              existingFunc.currentVersion?.outputSchema) as JsonSchema,
            rawDescription: (input.payload.rawDescription ??
              existingFunc.currentVersion?.rawDescription) as RawContent,
            behavior: (input.payload.behavior ??
              existingFunc.currentVersion?.behavior) as RawContent,
            code: (input.payload.code ??
              existingFunc.currentVersion?.code) as string,
            packages: (input.payload.packages ??
              existingFunc.currentVersion?.packages) as Package[],
            resources: (input.payload.resources ??
              existingFunc.currentVersion?.resources) as RequirementResource[],
            docs: (input.payload.docs ??
              existingFunc.currentVersion?.docs) as string,
            errors: (input.payload.errors ??
              existingFunc.currentVersion?.errors) as string,
          };

          const hash = generateFuncVersionHash(versionData);

          const newVersion = (
            await tx
              .insert(funcVersions)
              .values({
                ...versionData,
                versionTitle: input.payload.versionTitle,
                versionNumber:
                  (existingFunc.currentVersion?.versionNumber ?? 0) + 1,
                hash,
                funcId: existingFunc.id,
                userId: ctx.session.user.id,
                messageId: input.payload.messageId,
              })
              .returning()
          )[0];

          if (!newVersion) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create new version",
            });
          }

          await tx
            .update(funcs)
            .set({
              name: input.payload.name,
              currentVersionId: newVersion.id,
            })
            .where(
              and(
                eq(funcs.id, existingFunc.id),
                eq(funcs.userId, ctx.session.user.id),
              ),
            );

          return newVersion;
        });

        return newVersion;
      } catch (error) {
        console.error(error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update function",
        });
      }
    }),
  revertToPreviousVersion: protectedProcedure
    .input(z.object({ versionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db.transaction(async (tx) => {
          const previousVersion = await tx.query.funcVersions.findFirst({
            where: and(
              eq(funcVersions.id, input.versionId),
              eq(funcVersions.userId, ctx.session.user.id),
            ),
            with: {
              message: true,
            },
          });

          if (!previousVersion) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Previous version or function not found",
            });
          }

          // Check for missing dependencies
          const isMissingDeps = await isMissingDependencies(
            previousVersion.id,
            "func",
          );

          if (isMissingDeps) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                "Cannot revert to this version because some or all of its dependencies are missing",
            });
          }

          // Check for dependency mismatch
          const hasMismatch = await hasDependencyMismatch(
            previousVersion.id,
            "func",
          );

          if (hasMismatch) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                "Cannot revert to this version because its dependencies have incompatible changes",
            });
          }

          await tx
            .update(funcs)
            .set({
              currentVersionId: previousVersion.id,
            })
            .where(eq(funcs.id, previousVersion.funcId));

          // Delete all versions after the previous version
          await tx
            .delete(funcVersions)
            .where(
              and(
                eq(funcVersions.funcId, previousVersion.funcId),
                gt(funcVersions.createdAt, previousVersion.createdAt),
              ),
            );

          if (!previousVersion.message) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Previous version or function not found",
            });
          }

          // Delete the messages after the previous version
          await tx
            .delete(conversationMessages)
            .where(
              and(
                eq(
                  conversationMessages.conversationId,
                  previousVersion.message.conversationId,
                ),
                gt(conversationMessages.createdAt, previousVersion.createdAt),
              ),
            );
        });
      } catch (error) {
        console.error(error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to revert to previous version",
        });
      }
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db.transaction(async (tx) => {
          const func = await ctx.db.query.funcs.findFirst({
            where: and(
              eq(funcs.id, input.id),
              eq(funcs.userId, ctx.session.user.id),
            ),
          });

          if (!func || !func.conversationId) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Function not found",
            });
          }

          await tx
            .delete(funcs)
            .where(
              and(eq(funcs.id, func.id), eq(funcs.userId, ctx.session.user.id)),
            );

          await tx
            .delete(conversations)
            .where(eq(conversations.id, func.conversationId));
        });
      } catch (error) {
        console.error(error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete function",
        });
      }
    }),
} satisfies TRPCRouterRecord;
