import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { and, desc, eq } from "@weldr/db";
import { branches, chats, versions } from "@weldr/db/schema";
import { Tigris } from "@weldr/shared/tigris";
import type {
  AssistantMessage,
  ChatMessage,
  ToolMessage,
} from "@weldr/shared/types";

import { protectedProcedure } from "../init";

export const versionRouter = {
  create: protectedProcedure
    .input(z.object({ projectId: z.string(), branchId: z.string().optional() }))
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

      let branchId: string | undefined = input.branchId;
      let headVersionNumber: number | undefined;

      if (!branchId) {
        const branch = await ctx.db.query.branches.findFirst({
          where: and(
            eq(branches.projectId, input.projectId),
            eq(branches.isMain, true),
          ),
          with: {
            headVersion: {
              columns: {
                number: true,
              },
            },
          },
        });

        if (!branch) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Branch not found",
          });
        }

        branchId = branch.id;
        headVersionNumber = branch.headVersion?.number;
      }

      const version = await ctx.db.insert(versions).values({
        projectId: input.projectId,
        userId: ctx.session.user.id,
        number: headVersionNumber ? headVersionNumber + 1 : 1,
        chatId: chat.id,
        branchId,
      });

      return version;
    }),
  byId: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const versionResult = await ctx.db.query.versions.findFirst({
        where: eq(versions.id, input.id),
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
      });

      if (!versionResult) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Version not found",
        });
      }

      const getMessagesWithAttachments = async (
        version: typeof versionResult,
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
                  item?.type === "tool-call" && item?.toolName === "call_coder"
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

      const getVersionDeclarations = (version: typeof versionResult) => {
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
            dependentId: declarationToCanvasNodeMap.get(dependency.dependentId),
          })),
        }));
      };

      const versionDeclarations = getVersionDeclarations(versionResult);

      const edges = Array.from(
        new Map(
          versionDeclarations
            .flatMap((decl) => decl.edges)
            .map((edge) => [`${edge.dependencyId}-${edge.dependentId}`, edge]),
        ).values(),
      ).filter(
        (edge) =>
          edge.dependencyId !== undefined && edge.dependentId !== undefined,
      ) as {
        dependencyId: string;
        dependentId: string;
      }[];

      return {
        ...versionResult,
        edges,
        chat: {
          ...versionResult.chat,
          messages: (await getMessagesWithAttachments(
            versionResult,
          )) as ChatMessage[],
        },
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
          publishedAt: true,
          projectId: true,
        },
      });

      return versionsList;
    }),
};
