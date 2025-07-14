import { TRPCError, type TRPCRouterRecord } from "@trpc/server";
import { and, eq, isNotNull } from "@weldr/db";
import {
  attachments,
  chatMessages,
  chats,
  projects,
  versions,
} from "@weldr/db/schema";
import { Fly } from "@weldr/shared/fly";
import { machineLookupStore } from "@weldr/shared/machine-lookup-store";
import { nanoid } from "@weldr/shared/nanoid";
import { Tigris } from "@weldr/shared/tigris";
import type { ChatMessage } from "@weldr/shared/types";
import {
  insertProjectSchema,
  updateProjectSchema,
} from "@weldr/shared/validators/projects";
import { z } from "zod";
import { protectedProcedure } from "../init";

export const projectsRouter = {
  create: protectedProcedure
    .input(insertProjectSchema)
    .mutation(async ({ ctx, input }) => {
      let devMachineId: string | null = null;
      let developmentAppId: string | null = null;
      let productionAppId: string | null = null;
      let bucketCredentials: {
        accessKeyId: string;
        secretAccessKey: string;
      } | null = null;
      const projectId = nanoid();

      try {
        return await ctx.db.transaction(async (tx) => {
          // Create development app
          developmentAppId = await Fly.app.create({
            type: "development",
            projectId,
          });

          productionAppId = await Fly.app.create({
            type: "production",
            projectId,
          });

          // Create Tigris bucket
          bucketCredentials = await Tigris.bucket.create(projectId);

          // Create secrets
          await Promise.all([
            Fly.secret.create({
              type: "development",
              projectId,
              key: "AWS_ACCESS_KEY_ID",
              value: bucketCredentials.accessKeyId,
            }),
            Fly.secret.create({
              type: "development",
              projectId,
              key: "AWS_SECRET_ACCESS_KEY",
              value: bucketCredentials.secretAccessKey,
            }),
            Fly.secret.create({
              type: "development",
              projectId,
              key: "FLY_API_TOKEN",
              // biome-ignore lint/style/noNonNullAssertion: <explanation>
              value: process.env.FLY_API_TOKEN!,
            }),
          ]);

          // Create development node
          devMachineId = await Fly.machine.create({
            type: "development",
            projectId,
            config: Fly.machine.presets.development,
          });

          if (!devMachineId) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create project",
            });
          }

          await machineLookupStore.set(
            `${projectId}:dev-machine-id`,
            devMachineId,
          );

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
              visibility: "public",
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

          await tx.insert(versions).values({
            projectId: projectId,
            userId: ctx.session.user.id,
            chatId: chat.id,
          });

          return project;
        });
      } catch (error) {
        console.error(error);
        if (error instanceof TRPCError) {
          throw error;
        }

        const cleanupPromises = [];

        if (devMachineId) {
          cleanupPromises.push(
            Fly.machine.destroy({
              type: "development",
              projectId,
              machineId: devMachineId,
            }),
          );
        }

        if (developmentAppId) {
          cleanupPromises.push(
            Fly.app.destroy({
              type: "development",
              projectId,
            }),
          );
        }

        if (productionAppId) {
          cleanupPromises.push(
            Fly.app.destroy({
              type: "production",
              projectId,
            }),
          );
        }

        if (bucketCredentials) {
          cleanupPromises.push(Tigris.bucket.delete(projectId));
        }

        await Promise.all(cleanupPromises);

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
        with: {
          versions: {
            where: isNotNull(versions.activatedAt),
          },
        },
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
              },
              with: {
                environmentVariableMappings: {
                  columns: {
                    environmentVariableId: true,
                    mapTo: true,
                  },
                },
                integrationTemplate: {
                  with: {
                    variables: true,
                  },
                },
              },
            },
            versions: {
              limit: 1,
              where: input.versionId
                ? eq(versions.id, input.versionId)
                : isNotNull(versions.activatedAt),
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
              with: {
                chat: {
                  with: {
                    messages: {
                      orderBy: (messages, { asc }) => [asc(messages.createdAt)],
                      where: eq(chatMessages.visibility, "public"),
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

        const getMessagesWithAttachments = async (
          version: (typeof project.versions)[number],
        ) => {
          return await Promise.all(
            version.chat.messages.map(async (message) => {
              const attachmentsWithUrls = await Promise.all(
                message.attachments.map(async (attachment) => ({
                  name: attachment.name,
                  url: await Tigris.object.getSignedUrl(
                    // biome-ignore lint/style/noNonNullAssertion: <explanation>
                    process.env.GENERAL_BUCKET!,
                    attachment.key,
                  ),
                })),
              );
              return {
                ...message,
                attachments: attachmentsWithUrls,
              };
            }),
          );
        };

        const getVersionDeclarations = (
          version: (typeof project.versions)[number],
        ) => {
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

        const currentVersion = project.versions[0];

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

        const previousVersion = await ctx.db.query.versions.findFirst({
          where: and(
            eq(versions.projectId, input.id),
            eq(versions.number, currentVersion.number - 1),
          ),
          columns: {
            id: true,
          },
        });

        const nextVersion = await ctx.db.query.versions.findFirst({
          where: and(
            eq(versions.projectId, input.id),
            eq(versions.number, currentVersion.number + 1),
          ),
          columns: {
            id: true,
          },
        });

        const result = {
          ...project,
          currentVersion: {
            ...currentVersion,
            previousVersionId: previousVersion?.id,
            nextVersionId: nextVersion?.id,
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
            type: "production",
            projectId: project.id,
          }),
          Tigris.bucket.delete(project.id),
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
