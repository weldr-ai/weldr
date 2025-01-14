import { TRPCError, type TRPCRouterRecord } from "@trpc/server";

import {
  conversationMessages,
  conversations,
  dependencies,
  funcDefinitionPackages,
  funcDefinitionResources,
  funcDefinitions,
  funcs,
  packages,
} from "@integramind/db/schema";

import { and, eq } from "@integramind/db";
import { toKebabCase } from "@integramind/shared/utils";
import {
  createFuncDefinitionSchema,
  insertFuncSchema,
  updateFuncSchema,
} from "@integramind/shared/validators/funcs";
import { createPatch } from "diff";
import { z } from "zod";
import { protectedProcedure } from "../trpc";
import {
  createVersion,
  defineVersion,
  isFunctionReady,
  wouldCreateCycle,
} from "../utils";

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

          return {
            ...newFunc,
            conversationId: conversation.id,
            conversation: {
              ...conversation,
              messages: [],
            },
          };
        });

        const { integrationId, currentDefinitionId, ...rest } = result;

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
          ),
          with: {
            currentDefinition: {
              columns: {
                name: true,
                inputSchema: true,
                outputSchema: true,
                rawDescription: true,
                behavior: true,
                errors: true,
                testInput: true,
              },
            },
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
          currentDefinitionId,
          currentDefinition,
          ...rest
        } = result;

        return {
          ...rest,
          ...currentDefinition,
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

        const { integrationId, currentDefinitionId, ...updatedFuncRest } =
          updatedFunc;

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
  define: protectedProcedure
    .input(createFuncDefinitionSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db.transaction(async (tx) => {
          const func = await tx.query.funcs.findFirst({
            where: and(
              eq(funcs.id, input.where.id),
              eq(funcs.userId, ctx.session.user.id),
            ),
            with: {
              currentDefinition: {
                with: {
                  resources: true,
                  packages: true,
                },
              },
            },
          });

          if (!func || !func.projectId || !func.conversationId) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Function not found",
            });
          }

          const {
            resources,
            packages: pkgs,
            helperFunctionIds,
            ...rest
          } = input.payload;

          const diff = await createPatch(
            `lib/functions/${toKebabCase(rest.name)}.ts`,
            "",
            rest.code,
          );

          const assistantBuiltMessage = await tx
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
              conversationId: func.conversationId,
              userId: ctx.session.user.id,
            })
            .returning()
            .then(([message]) => message);

          if (!assistantBuiltMessage) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to define function",
            });
          }

          const { newVersion, previousVersion } = await createVersion({
            db: tx,
            versionName: `${rest.name} (created)`,
            projectId: func.projectId,
            userId: ctx.session.user.id,
            messageId: assistantBuiltMessage.id,
          });

          const newDefinition = await tx
            .insert(funcDefinitions)
            .values({
              diff,
              userId: ctx.session.user.id,
              funcId: func.id,
              versionId: newVersion.id,
              ...rest,
            })
            .returning()
            .then(([func]) => func);

          if (!newDefinition || !newDefinition.name || !newDefinition.id) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to define function",
            });
          }

          await tx
            .update(funcs)
            .set({
              currentDefinitionId: newDefinition.id,
            })
            .where(eq(funcs.id, func.id));

          if (resources) {
            for (const resource of resources) {
              await tx.insert(funcDefinitionResources).values({
                funcDefinitionId: newDefinition.id,
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
                  projectId: func.projectId,
                })
                .onConflictDoNothing()
                .returning()
                .then(([pkg]) => pkg);

              if (!newPkg) {
                throw new TRPCError({
                  code: "INTERNAL_SERVER_ERROR",
                  message: "Failed to define function",
                });
              }

              await tx
                .insert(funcDefinitionPackages)
                .values({
                  funcDefinitionId: newDefinition.id,
                  packageId: newPkg.id,
                })
                .onConflictDoNothing();
            }
          }

          if (helperFunctionIds) {
            for (const helperFunctionId of helperFunctionIds) {
              const helperFunction = await tx.query.funcs.findFirst({
                where: and(
                  eq(funcs.id, helperFunctionId),
                  eq(funcs.userId, ctx.session.user.id),
                ),
              });

              if (!helperFunction || !helperFunction.currentDefinitionId) {
                throw new TRPCError({
                  code: "NOT_FOUND",
                  message: "Helper function not found",
                });
              }

              const isCycle = await wouldCreateCycle({
                dependentId: newDefinition.id,
                dependencyId: helperFunction.currentDefinitionId,
                db: tx,
              });

              if (isCycle) {
                throw new TRPCError({
                  code: "BAD_REQUEST",
                  message: "Dependency cycle detected",
                });
              }

              await tx.insert(dependencies).values({
                dependentDefinitionId: newDefinition.id,
                dependentType: "function",
                dependencyDefinitionId: helperFunctionId,
                dependencyType: "function",
              });
            }
          }

          await defineVersion({
            db: tx,
            previousVersionId: previousVersion.id,
            newVersionId: newVersion.id,
            addedFuncDefinitionIds: [newDefinition.id],
          });
        });
      } catch (error) {
        console.error(error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to define function",
        });
      }
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db.transaction(async (tx) => {
          const func = await tx.query.funcs.findFirst({
            where: and(
              eq(funcs.id, input.id),
              eq(funcs.userId, ctx.session.user.id),
            ),
            with: {
              currentDefinition: true,
            },
          });

          if (!func || !func.conversationId || !func.projectId) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Function not found",
            });
          }

          // If function is implemented, create a new version and delete the old function
          if (func.currentDefinition) {
            try {
              const { newVersion, previousVersion } = await createVersion({
                db: tx,
                userId: ctx.session.user.id,
                projectId: func.projectId,
                versionName: `${func.currentDefinition.name} (deleted)`,
              });

              await defineVersion({
                db: tx,
                previousVersionId: previousVersion.id,
                newVersionId: newVersion.id,
                deletedFuncDefinitionIds: [func.currentDefinition.id],
              });
            } catch (error) {
              console.error(error);
              throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to delete function",
              });
            }
          } else {
            await tx.delete(funcs).where(eq(funcs.id, func.id));
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
