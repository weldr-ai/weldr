import { createId } from "@paralleldrive/cuid2";
import { TRPCError, type TRPCRouterRecord } from "@trpc/server";
import { and, eq } from "@weldr/db";
import {
  attachments,
  chatMessages,
  chats,
  projects,
  versions,
} from "@weldr/db/schema";
import { Fly } from "@weldr/shared/fly";
import { S3 } from "@weldr/shared/s3";
import type { ChatMessage } from "@weldr/shared/types";
import {
  insertProjectSchema,
  updateProjectSchema,
} from "@weldr/shared/validators/projects";
import { ofetch } from "ofetch";
import { z } from "zod";
import { protectedProcedure } from "../trpc";

export const projectsRouter = {
  create: protectedProcedure
    .input(insertProjectSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await ctx.db.transaction(async (tx) => {
          const projectId = createId();

          const app = await Fly.app.create({
            appName: `preview-app-${projectId}`,
            networkName: `preview-net-${projectId}`,
          });

          if (!app?.id) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create app",
            });
          }

          const [project] = await tx
            .insert(projects)
            .values({
              id: projectId,
              subdomain: projectId,
              userId: ctx.session.user.id,
            })
            .returning();

          if (!project) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create project",
            });
          }

          const [chat] = await tx
            .insert(chats)
            .values({
              userId: ctx.session.user.id,
              projectId: projectId,
            })
            .returning();

          if (!chat) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create chat",
            });
          }

          const [message] = await tx
            .insert(chatMessages)
            .values({
              chatId: chat.id,
              role: "user",
              content: input.message,
              rawContent: [
                {
                  type: "paragraph",
                  value: input.message,
                },
              ],
              userId: ctx.session.user.id,
            })
            .returning();

          if (!message) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create message",
            });
          }

          if (input.attachments.length > 0) {
            await tx.insert(attachments).values(
              input.attachments.map((attachment) => ({
                key: attachment.key,
                name: attachment.name,
                contentType: attachment.contentType,
                size: attachment.size,
                messageId: message.id,
                userId: ctx.session.user.id,
              })),
            );
          }

          return project;
        });
      } catch (error) {
        console.error(error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create project",
        });
      }
    }),
  list: protectedProcedure.query(async ({ ctx }) => {
    try {
      const result = await ctx.db.query.projects.findMany({
        where: eq(projects.userId, ctx.session.user.id),
      });
      return result;
    } catch (error) {
      console.error(error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to list projects",
      });
    }
  }),
  byId: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const project = await ctx.db.query.projects.findFirst({
          where: and(
            eq(projects.id, input.id),
            eq(projects.userId, ctx.session.user.id),
          ),
          with: {
            versions: true,
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
            environmentVariables: {
              columns: {
                secretId: false,
              },
            },
          },
        });

        if (!project) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Project not found",
          });
        }

        const [chat] = project.chats;

        if (!chat) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Chat not found",
          });
        }

        const messagesWithAttachments = await Promise.all(
          chat.messages.map(async (message) => {
            const attachmentsWithUrls = await Promise.all(
              message.attachments.map(async (attachment) => ({
                name: attachment.name,
                url: await S3.getAttachmentUrl(attachment.key),
              })),
            );
            return {
              ...message,
              attachments: attachmentsWithUrls,
            };
          }),
        );

        const getCurrentVersionDeclarations = async (
          currentVersionId: string,
        ) => {
          const currentVersion = await ctx.db.query.versions.findFirst({
            where: eq(versions.id, currentVersionId),
            with: {
              declarations: {
                with: {
                  declaration: {
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
                                orderBy: (messages, { asc }) => [
                                  asc(messages.createdAt),
                                ],
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
                  },
                },
              },
            },
          });

          if (!currentVersion) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Current version not found",
            });
          }

          return currentVersion.declarations
            .filter((declaration) => declaration.declaration.canvasNode)
            .map((declaration) => declaration.declaration);
        };

        const currentVersion = project.versions.find(
          (version) => version.isCurrent,
        );

        const result = {
          ...project,
          chat: {
            ...chat,
            messages: messagesWithAttachments as ChatMessage[],
          },
          currentVersion,
          declarations: currentVersion
            ? await getCurrentVersionDeclarations(currentVersion.id)
            : undefined,
        };

        return result;
      } catch (error) {
        console.error(error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get project",
        });
      }
    }),
  update: protectedProcedure
    .input(updateProjectSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await ctx.db
          .update(projects)
          .set(input.payload)
          .where(
            and(
              eq(projects.id, input.where.id),
              eq(projects.userId, ctx.session.user.id),
            ),
          )
          .returning()
          .then(([project]) => project);

        if (!result) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Project not found",
          });
        }

        return result;
      } catch (error) {
        console.error(error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update project",
        });
      }
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const project = await ctx.db.query.projects.findFirst({
          where: and(
            eq(projects.id, input.id),
            eq(projects.userId, ctx.session.user.id),
          ),
        });

        if (!project) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Project not found",
          });
        }

        const response = await ofetch(
          `${process.env.DEPLOYER_API_URL}/projects`,
          {
            method: "DELETE",
            retry: 3,
            retryDelay: 1000,
            body: {
              projectId: input.id,
            },
          },
        );

        if (response.status !== 200) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to delete project",
          });
        }

        await ctx.db
          .delete(projects)
          .where(
            and(
              eq(projects.id, input.id),
              eq(projects.userId, ctx.session.user.id),
            ),
          );
      } catch (error) {
        console.error(error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete project",
        });
      }
    }),
} satisfies TRPCRouterRecord;
