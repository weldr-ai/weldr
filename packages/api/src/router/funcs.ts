import { TRPCError, type TRPCRouterRecord } from "@trpc/server";

import {
  conversationMessages,
  conversations,
  funcPackages,
  funcResources,
  funcs,
  packages,
  versionFuncs,
  versions,
} from "@integramind/db/schema";

import { type InferInsertModel, and, eq } from "@integramind/db";
import { toKebabCase, toTitle } from "@integramind/shared/utils";
import {
  createNewFuncVersionSchema,
  insertFuncSchema,
  updateFuncSchema,
} from "@integramind/shared/validators/funcs";
import { createPatch } from "diff";
import { z } from "zod";
import { protectedProcedure } from "../trpc";
import { createVersion, isFunctionReady } from "../utils";

export const funcsRouter = {
  create: protectedProcedure
    .input(insertFuncSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await ctx.db.transaction(async (tx) => {
          const conversation = await tx
            .insert(conversations)
            .values({
              userId: ctx.session.user.id,
            })
            .returning()
            .then(([conversation]) => conversation);

          if (!conversation) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create conversation",
            });
          }

          const newFunc = await tx
            .insert(funcs)
            .values({
              ...input,
              userId: ctx.session.user.id,
              conversationId: conversation?.id,
            })
            .returning()
            .then(([func]) => func);

          if (!newFunc) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create function",
            });
          }

          const currentVersion = await tx.query.versions.findFirst({
            where: and(
              eq(versions.projectId, input.projectId),
              eq(versions.isActive, true),
            ),
            with: {
              funcs: true,
            },
          });

          if (!currentVersion) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create function",
            });
          }

          await tx.insert(versionFuncs).values({
            funcId: newFunc.id,
            versionId: currentVersion.id,
          });

          return {
            ...newFunc,
            conversationId: conversation.id,
            conversation: {
              ...conversation,
              messages: [],
            },
          };
        });

        const {
          integrationId,
          diff,
          docs,
          isDeleted,
          parentId,
          code,
          isDeployed,
          ...rest
        } = result;

        return {
          ...rest,
          canRun: await isFunctionReady(result),
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
            eq(funcs.isDeleted, false),
          ),
          with: {
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
                    version: {
                      columns: {
                        id: true,
                        versionName: true,
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

        const {
          integrationId,
          diff,
          docs,
          isDeleted,
          parentId,
          code,
          isDeployed,
          ...rest
        } = result;

        return {
          ...rest,
          canRun: await isFunctionReady(result),
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
            eq(funcs.isDeleted, false),
          ),
        });

        if (!func) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Function not found",
          });
        }

        const updatedFunc = await ctx.db
          .update(funcs)
          .set(input.payload)
          .where(eq(funcs.id, func.id))
          .returning()
          .then(([func]) => func);

        if (!updatedFunc) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to update function",
          });
        }

        const {
          integrationId,
          diff,
          docs,
          isDeleted,
          parentId,
          code,
          isDeployed,
          ...updatedFuncRest
        } = updatedFunc;

        return {
          ...updatedFuncRest,
          canRun: await isFunctionReady(updatedFunc),
        };
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
        await ctx.db.transaction(async (tx) => {
          const func = await tx.query.funcs.findFirst({
            where: and(
              eq(funcs.id, input.where.id),
              eq(funcs.userId, ctx.session.user.id),
              eq(funcs.isDeleted, false),
            ),
          });

          if (!func || !func.projectId) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Function not found",
            });
          }

          const { resources, packages: pkgs, ...rest } = input.payload;
          const firstImplementation = !func.code;
          let newFunc: InferInsertModel<typeof funcs> | undefined;

          if (!func.code) {
            newFunc = await tx
              .update(funcs)
              .set(rest)
              .where(eq(funcs.id, func.id))
              .returning()
              .then(([func]) => func);
          } else {
            newFunc = await tx
              .insert(funcs)
              .values({
                ...func,
                ...rest,
                parentId: func.id,
              })
              .returning()
              .then(([func]) => func);
          }

          if (
            !newFunc ||
            !newFunc.name ||
            !newFunc.id ||
            !newFunc.projectId ||
            !newFunc.conversationId
          ) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create function",
            });
          }

          if (resources) {
            for (const resource of resources) {
              await tx.insert(funcResources).values({
                funcId: newFunc.id,
                resourceId: resource.id,
                metadata: resource,
              });
            }
          }

          if (pkgs) {
            for (const pkg of pkgs) {
              const newPkg = await tx
                .insert(packages)
                .values({
                  ...pkg,
                  projectId: newFunc.projectId,
                })
                .onConflictDoNothing()
                .returning()
                .then(([pkg]) => pkg);

              if (!newPkg) {
                throw new TRPCError({
                  code: "INTERNAL_SERVER_ERROR",
                  message: "Failed to create function",
                });
              }

              await tx
                .insert(funcPackages)
                .values({
                  funcId: newFunc.id,
                  packageId: newPkg.id,
                })
                .onConflictDoNothing();
            }
          }

          // Add message to conversation
          const assistantBuiltMessage = await ctx.db
            .insert(conversationMessages)
            .values({
              role: "assistant",
              content: "Your function has been built successfully!",
              rawContent: [
                {
                  type: "text",
                  value: "Your function has been built successfully!",
                },
              ],
              conversationId: newFunc.conversationId,
            })
            .returning()
            .then(([message]) => message);

          if (!assistantBuiltMessage) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create new function version",
            });
          }

          // If function is implemented, create a new version and delete the old function
          // else, just create a new version with the new function
          try {
            await createVersion({
              db: ctx.db,
              tx: tx,
              input: {
                userId: ctx.session.user.id,
                projectId: newFunc.projectId,
                versionName: `${toTitle(newFunc.name)} (${
                  firstImplementation ? "created" : "updated"
                })`,
                addedFuncIds: [newFunc.id],
                deletedFuncIds: firstImplementation ? [] : [func.id],
                messageId: assistantBuiltMessage.id,
              },
            });
          } catch (error) {
            console.error(error);
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create new function version",
            });
          }
        });
      } catch (error) {
        console.error(error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create new function version",
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
              eq(funcs.isDeleted, false),
            ),
          });

          if (!func || !func.conversationId || !func.projectId) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Function not found",
            });
          }

          let diff: string | undefined;

          if (func.name && func.code) {
            diff = createPatch(
              `lib/functions/${toKebabCase(func.name)}.ts`,
              func.code,
              "",
            );
          }

          await tx
            .update(funcs)
            .set({
              isDeleted: true,
              isDeployed: false,
              diff,
            })
            .where(
              and(
                eq(funcs.id, func.id),
                eq(funcs.userId, ctx.session.user.id),
                eq(funcs.isDeleted, false),
              ),
            );

          // If function is implemented, create a new version and delete the old function
          // else, just delete the function from the current version
          if (func.name) {
            try {
              await createVersion({
                db: ctx.db,
                tx: tx,
                input: {
                  userId: ctx.session.user.id,
                  projectId: func.projectId,
                  versionName: `${func.name} (deleted)`,
                  deletedFuncIds: [func.id],
                },
              });
            } catch (error) {
              console.error(error);
              throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to delete function",
              });
            }
          } else {
            await tx
              .delete(versionFuncs)
              .where(eq(versionFuncs.funcId, func.id));
          }
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
