import { type Db, type Tx, and, db, eq } from "@weldr/db";
import { chatMessages, chats } from "@weldr/db/schema";
import { assistantMessageRawContentToText } from "@weldr/shared/utils";
import type { addMessagesInputSchema } from "@weldr/shared/validators/chats";
import type { z } from "zod";

export async function insertMessages({
  tx,
  input,
}: {
  tx?: Tx;
  input: z.infer<typeof addMessagesInputSchema> & {
    userId: string;
  };
}) {
  if (input.messages.length === 0) {
    return [];
  }

  let database: Tx | Db | undefined = tx;

  if (!database) {
    database = db;
  }

  const chat = await database.query.chats.findFirst({
    where: and(eq(chats.id, input.chatId), eq(chats.userId, input.userId)),
  });

  if (!chat) {
    throw new Error("Chat not found");
  }

  const messages: (typeof chatMessages.$inferInsert)[] = [];

  for (const item of input.messages) {
    // const resolvedRawContent: ResolvedRawContent[] = [];

    // FIXME: this must be resolved raw content to resolve the embedded references
    // if (item.role === "user") {
    //   resolvedRawContent.push(
    //     ...(await resolveRawContent(item.rawContent, ctx)),
    //   );
    // }

    messages.push({
      id: item.role === "user" ? item.id : undefined,
      content:
        item.role === "user"
          ? // FIXME: this must be resolved raw content to resolve the embedded references
            assistantMessageRawContentToText(item.rawContent)
          : item.role === "assistant"
            ? assistantMessageRawContentToText(item.rawContent)
            : undefined,
      rawContent: item.rawContent,
      role: item.role,
      userId: input.userId,
      chatId: input.chatId,
    });
  }

  const insertedMessages = await database
    .insert(chatMessages)
    .values(messages)
    .returning({
      id: chatMessages.id,
    });

  return insertedMessages.map((message) => message.id);
}
