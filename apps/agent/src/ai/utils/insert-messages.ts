import type { z } from "zod";

import { and, db, eq } from "@weldr/db";
import { chatMessages, chats } from "@weldr/db/schema";
import type { addMessagesInputSchema } from "@weldr/shared/validators/chats";

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
    messages.push({
      visibility: item.visibility,
      content: item.content,
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
