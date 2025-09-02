import { TRPCError, type TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";

import { and, eq } from "@weldr/db";
import {
  attachments,
  branches,
  chatMessages,
  chats,
  projects,
  versions,
} from "@weldr/db/schema";
import { Fly } from "@weldr/shared/fly";
import { nanoid } from "@weldr/shared/nanoid";
import { Tigris } from "@weldr/shared/tigris";
import type {
  AssistantMessage,
  ChatMessage,
  ToolMessage,
} from "@weldr/shared/types";
import {
  insertProjectSchema,
  updateProjectSchema,
} from "@weldr/shared/validators/projects";

import { protectedProcedure } from "../init";

export const projectsRouter = {
  create: protectedProcedure
    .input(insertProjectSchema)
    .mutation(async ({ ctx, input }) => {
      const projectId = nanoid();

      try {
        return await ctx.db.transaction(async (tx) => {
          await Promise.all([
            Fly.app.create({
              type: "development",
              projectId,
            }),
            Fly.app.create({
              type: "preview",
              projectId,
            }),
            Fly.app.create({
              type: "production",
              projectId,
            }),
          ]);

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
              content: [
                {
                  type: "text",
                  text: input.message,
                },
              ],
              userId: ctx.session.user.id,
            })
            .returning();

          if (!message) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create project",
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

          const [mainBranch] = await tx
            .insert(branches)
            .values({
              projectId: projectId,
              isMain: true,
            })
            .returning();

          if (!mainBranch) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create main branch",
            });
          }

          await tx.insert(versions).values({
            projectId: projectId,
            userId: ctx.session.user.id,
            chatId: chat.id,
            branchId: mainBranch.id,
          });

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
    .input(z.object({ id: z.string(), versionId: z.string().optional() }))
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
                key: true,
                status: true,
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
                    id: true,
                    name: true,
                    description: true,
                    key: true,
                    isRecommended: true,
                    version: true,
                    variables: true,
                    options: true,
                    recommendedOptions: true,
                  },
                  with: {
                    category: true,
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

        const branch = await ctx.db.query.branches.findFirst({
          where: and(
            eq(branches.projectId, input.id),
            eq(branches.isMain, true),
          ),
          with: {
            headVersion: {
              columns: {
                id: true,
                message: true,
                createdAt: true,
                parentVersionId: true,
                number: true,
                status: true,
                description: true,
                projectId: true,
                publishedAt: true,
              },
              with: {
                chat: {
                  with: {
                    messages: {
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
                declarations: {
                  with: {
                    declaration: {
                      columns: {
                        id: true,
                        metadata: true,
                        nodeId: true,
                        progress: true,
                      },
                      with: {
                        node: true,
                        dependencies: true,
                      },
                    },
                  },
                },
              },
            },
          },
        });

        if (!branch || !branch.headVersion) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Branch not found",
          });
        }

        const getMessagesWithAttachments = async (
          version: typeof branch.headVersion,
        ) => {
          const results = [];

          for (const message of version.chat.messages) {
            // Filter assistant messages for call_coder tool calls
            let content = message.content as
              | ToolMessage["content"]
              | AssistantMessage["content"];

            // Skip tool messages with call_coder results
            if (message.role === "tool" && Array.isArray(message.content)) {
              content = content.filter(
                (item) =>
                  !(
                    item?.type === "tool-result" &&
                    item?.toolName === "call_coder"
                  ),
              );
            } else if (message.role === "assistant") {
              content = content.filter(
                (item) =>
                  !(
                    item?.type === "tool-call" &&
                    item?.toolName === "call_coder"
                  ),
              );
            }

            if (content.length === 0) continue;

            // Get attachment URLs
            const attachmentsWithUrls = await Promise.all(
              message.attachments.map(async (attachment) => ({
                name: attachment.name,
                url: await Tigris.object.getSignedUrl(
                  // biome-ignore lint/style/noNonNullAssertion: reason
                  process.env.GENERAL_BUCKET!,
                  attachment.key,
                ),
              })),
            );

            results.push({
              ...message,
              content,
              attachments: attachmentsWithUrls,
            });
          }

          return results;
        };

        const getVersionDeclarations = (version: typeof branch.headVersion) => {
          const declarations = version.declarations
            .filter((declaration) => declaration.declaration.node)
            .map((declaration) => declaration.declaration);

          const declarationToCanvasNodeMap = new Map(
            declarations.map((declaration) => [
              declaration.id,
              declaration.node?.id,
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

        const currentVersion = branch.headVersion;

        if (!currentVersion) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Version not found",
          });
        }

        const currentVersionDeclarations =
          getVersionDeclarations(currentVersion);

        const edges = Array.from(
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
          currentVersion: {
            ...currentVersion,
            edges,
            chat: {
              ...currentVersion.chat,
              messages: (await getMessagesWithAttachments(
                currentVersion,
              )) as ChatMessage[],
            },
          },
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

        await Promise.all([
          Fly.app.destroy({
            type: "development",
            projectId: project.id,
          }),
          Fly.app.destroy({
            type: "preview",
            projectId: project.id,
          }),
          Fly.app.destroy({
            type: "production",
            projectId: project.id,
          }),
          Tigris.bucket.delete(`app-${project.id}`),
        ]);

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
