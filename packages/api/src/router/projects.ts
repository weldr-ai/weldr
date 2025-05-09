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
            integrations: {
              columns: {
                id: true,
                name: true,
              },
              with: {
                environmentVariableMappings: {
                  columns: {
                    environmentVariableId: true,
                    mapTo: true,
                  },
                },
                integrationTemplate: {
                  columns: {
                    config: false,
                    llmTxt: false,
                    docsUrl: false,
                    version: false,
                  },
                },
              },
            },
            versions: {
              where: eq(versions.progress, "succeeded"),
            },
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
            mainDatabase: {
              columns: {
                id: true,
                name: true,
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
                url: await S3.getSignedUrl("weldr-general", attachment.key),
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
                      canvasNode: true,
                      dependencies: true,
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

          const declarations = currentVersion.declarations
            .filter(
              (declaration) =>
                declaration.declaration.canvasNode &&
                declaration.declaration.type !== "other",
            )
            .map((declaration) => declaration.declaration);

          const declarationToCanvasNodeMap = new Map(
            declarations.map((declaration) => [
              declaration.id,
              declaration.canvasNode?.id,
            ]),
          );

          return declarations.map((declaration) => ({
            declaration,
            edges: declaration.dependencies.map((dependency) => ({
              dependencyId: declarationToCanvasNodeMap.get(
                dependency.dependencyId,
              ),
              dependentId: declarationToCanvasNodeMap.get(
                dependency.dependentId,
              ),
            })),
          }));
        };

        const currentVersion = await ctx.db.query.versions.findFirst({
          where: and(
            eq(versions.projectId, project.id),
            eq(versions.isCurrent, true),
          ),
          with: {
            theme: true,
          },
        });

        const versionsWithThumbnails = await Promise.all(
          project.versions.map(async (version) => ({
            ...version,
            thumbnail: await S3.getSignedUrl(
              "weldr-controlled-general",
              `thumbnails/${project.id}/${version.id}.jpeg`,
            ),
          })),
        );

        const currentVersionDeclarations = currentVersion
          ? await getCurrentVersionDeclarations(currentVersion.id)
          : [];

        const uniqueEdges = Array.from(
          new Map(
            currentVersionDeclarations
              .flatMap((decl) => decl.edges)
              .map((edge) => [
                `${edge.dependencyId}-${edge.dependentId}`,
                edge,
              ]),
          ).values(),
        ).filter(
          (edge) =>
            edge.dependencyId !== undefined && edge.dependentId !== undefined,
        ) as {
          dependencyId: string;
          dependentId: string;
        }[];

        const result = {
          ...project,
          chat: {
            ...chat,
            messages: messagesWithAttachments as ChatMessage[],
          },
          currentVersion,
          versions: versionsWithThumbnails,
          declarations: currentVersionDeclarations.map(
            (decl) => decl.declaration,
          ),
          edges: uniqueEdges,
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

        await Fly.app.delete({
          appName: `preview-app-${project.id}`,
        });

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
