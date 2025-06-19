import { db, eq } from "@weldr/db";
import { chats } from "@weldr/db/schema";
import { prepareMessages } from "./prepare-messages";

export async function getMessages(chatId: string) {
  const chat = await db.query.chats.findFirst({
    where: eq(chats.id, chatId),
    with: {
      messages: {
        orderBy: (chatMessages, { asc }) => [asc(chatMessages.createdAt)],
      },
    },
  });

  if (!chat) {
    throw new Error("Chat not found");
  }

  const promptMessages = prepareMessages(chat.messages);

  return promptMessages;
}
