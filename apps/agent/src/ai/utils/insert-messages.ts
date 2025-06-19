import { and, db, eq } from "@weldr/db";
import { chatMessages, chats, declarations } from "@weldr/db/schema";
import { assistantMessageRawContentToText } from "@weldr/shared/utils";
import type { addMessagesInputSchema } from "@weldr/shared/validators/chats";
import type { rawContentSchema } from "@weldr/shared/validators/common";
import type { z } from "zod";

export async function insertMessages({
  input,
}: {
  input: z.infer<typeof addMessagesInputSchema> & {
    userId: string;
  };
}) {
  if (input.messages.length === 0) {
    return [];
  }

  const chat = await db.query.chats.findFirst({
    where: and(eq(chats.id, input.chatId), eq(chats.userId, input.userId)),
  });

  if (!chat) {
    throw new Error("Chat not found");
  }

  const messages: (typeof chatMessages.$inferInsert)[] = [];

  for (const item of input.messages) {
    const content =
      item.role === "user"
        ? await resolveRawContent(item.rawContent)
        : item.role === "assistant"
          ? assistantMessageRawContentToText(item.rawContent)
          : undefined;

    messages.push({
      type: item.type,
      content: content && content.length > 0 ? content : undefined,
      rawContent: item.rawContent,
      role: item.role,
      userId: input.userId,
      chatId: input.chatId,
    });
  }

  const insertedMessages = await db
    .insert(chatMessages)
    .values(messages)
    .returning({
      id: chatMessages.id,
    });

  return insertedMessages.map((message) => message.id);
}

async function resolveRawContent(rawContent: z.infer<typeof rawContentSchema>) {
  let content = "";

  for (const item of rawContent) {
    if (item.type === "paragraph") {
      content += item.value;
    }

    if (item.type === "reference") {
      const reference = await db.query.declarations.findFirst({
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
