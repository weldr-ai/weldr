import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import type { db } from "@weldr/db";
import { chatMessages, chats, declarations } from "@weldr/db/schema";
import { mergeJson } from "@weldr/db/utils";
import { S3 } from "@weldr/shared/s3";
import type { ChatMessage } from "@weldr/shared/types";
import { assistantMessageRawContentToText } from "@weldr/shared/utils";
import { addMessagesInputSchema } from "@weldr/shared/validators/chats";
import type { rawContentSchema } from "@weldr/shared/validators/common";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure } from "../init";

export const chatsRouter = {
  messages: protectedProcedure
    .input(z.object({ chatId: z.string() }))
    .query(async ({ ctx, input }) => {
      const messages = await ctx.db.query.chatMessages.findMany({
        where: and(
          eq(chatMessages.chatId, input.chatId),
          eq(chatMessages.userId, ctx.session.user.id),
        ),
        orderBy: (chatMessages, { asc }) => [asc(chatMessages.createdAt)],
        columns: {
          content: false,
        },
        with: {
          attachments: {
            columns: {
              name: true,
              key: true,
            },
          },
          user: {
            columns: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      });

      const messagesWithAttachments = await Promise.all(
        messages.map(async (message) => {
          const attachments = [];

          for (const attachment of message.attachments) {
            const url = await S3.getSignedUrl("weldr-general", attachment.key);

            attachments.push({
              name: attachment.name,
              url,
            });
          }

          return {
            ...message,
            attachments,
          };
        }),
      );

      return messagesWithAttachments as ChatMessage[];
    }),
  addMessage: protectedProcedure
    .input(addMessagesInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (input.messages.length === 0) {
        return;
      }

      const chat = await ctx.db.query.chats.findFirst({
        where: and(
          eq(chats.id, input.chatId),
          eq(chats.userId, ctx.session.user.id),
        ),
      });

      if (!chat) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Chat not found",
        });
      }

      const messages: (typeof chatMessages.$inferInsert)[] = [];

      for (const item of input.messages) {
        messages.push({
          id: item.role === "user" ? item.id : undefined,
          content:
            item.role === "user"
              ? await resolveRawContent(ctx, item.rawContent)
              : item.role === "assistant"
                ? assistantMessageRawContentToText(item.rawContent)
                : undefined,
          rawContent: item.rawContent,
          role: item.role,
          userId: ctx.session.user.id,
          chatId: input.chatId,
        });
      }

      await ctx.db.insert(chatMessages).values(messages);
    }),
  updateMessage: protectedProcedure
    .input(
      z.object({
        where: z.object({
          messageId: z.string(),
        }),
        data: z.object({
          type: z.literal("tool"),
          toolResult: z.any(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [message] = await ctx.db
        .update(chatMessages)
        .set({
          rawContent: mergeJson(chatMessages.rawContent, {
            toolResult: input.data.toolResult,
          }),
        })
        .where(
          and(
            eq(chatMessages.id, input.where.messageId),
            eq(chatMessages.userId, ctx.session.user.id),
          ),
        )
        .returning();

      if (!message) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Message not found",
        });
      }

      return message;
    }),
} satisfies TRPCRouterRecord;

async function resolveRawContent(
  ctx: {
    db: typeof db;
  },
  rawContent: z.infer<typeof rawContentSchema>,
) {
  let content = "";

  for (const item of rawContent) {
    if (item.type === "paragraph") {
      content += item.value;
    }

    if (item.type === "reference") {
      const reference = await ctx.db.query.declarations.findFirst({
        where: eq(declarations.id, item.id),
        with: {
          file: true,
          declarationPackages: {
            with: {
              package: true,
            },
          },
          dependents: {
            with: {
              dependent: {
                with: {
                  file: true,
                },
              },
            },
          },
          dependencies: {
            with: {
              dependency: {
                with: {
                  file: true,
                },
              },
            },
          },
        },
      });

      const groupedDependencies = reference?.dependencies.reduce(
        (acc, d) => {
          const accFile = acc[d.dependency.file.path];

          if (!accFile) {
            acc[d.dependency.file.path] = [];
          }

          accFile?.push(d.dependency);

          return acc;
        },
        {} as Record<
          string,
          (typeof reference.dependencies)[number]["dependency"][]
        >,
      );

      const groupedDependents = reference?.dependents.reduce(
        (acc, d) => {
          const accFile = acc[d.dependent.file.path];

          if (!accFile) {
            acc[d.dependent.file.path] = [];
          }

          accFile?.push(d.dependent);

          return acc;
        },
        {} as Record<
          string,
          (typeof reference.dependents)[number]["dependent"][]
        >,
      );

      if (!reference) {
        continue;
      }

      if (reference) {
        content += `${reference.name}
Type: ${reference.type}
File: ${reference.file.path}
${
  groupedDependencies && Object.keys(groupedDependencies).length > 0
    ? `Dependencies: ${Object.entries(groupedDependencies)
        .map(
          ([f, ds]) =>
            `From file: ${f} => ${ds?.map((d) => d.name).join(", ")}`,
        )
        .join(", ")}`
    : ""
}
${
  groupedDependents && Object.keys(groupedDependents).length > 0
    ? `Dependents: ${Object.entries(groupedDependents)
        .map(
          ([f, ds]) => `To file: ${f} => ${ds?.map((d) => d.name).join(", ")}`,
        )
        .join(", ")}`
    : ""
}
${reference.declarationPackages.length > 0 ? `External Packages: ${reference.declarationPackages.map((d) => `Depends on these declarations: [${d.declarations?.join(", ")}] from package: ${d.package.name}`).join(", ")}` : ""}`;
      }
    }
  }

  return content;
}
