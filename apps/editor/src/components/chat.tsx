import { simpleAgent } from "@/lib/ai/generator";
import { api } from "@/lib/trpc/client";
import { createId } from "@paralleldrive/cuid2";
import type { Attachment, ChatMessage, RawContent } from "@weldr/shared/types";
import { readStreamableValue } from "ai/rsc";
import { useCallback, useEffect, useState } from "react";
import { Messages } from "./messages";
import { MultimodalInput } from "./multimodal-input";

export function Chat({
  chatId,
  initialMessages,
}: {
  chatId: string;
  initialMessages: ChatMessage[];
}) {
  const [isThinking, setIsThinking] = useState(false);

  const addMessage = api.chats.addMessage.useMutation();

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);

  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const triggerGeneration = useCallback(async (prompt: RawContent) => {
    setIsThinking(true);

    const result = await simpleAgent(prompt);

    const newAssistantMessage: ChatMessage = {
      id: createId(),
      role: "assistant",
      rawContent: [],
      createdAt: new Date(),
    };

    for await (const text of readStreamableValue(result)) {
      if (!text) {
        continue;
      }

      setIsThinking(false);

      setMessages((prevMessages) => {
        const lastMessage = prevMessages[prevMessages.length - 1];

        if (!lastMessage) {
          return prevMessages;
        }

        if (lastMessage.role !== "assistant") {
          return [
            ...prevMessages,
            {
              ...newAssistantMessage,
              rawContent: [
                {
                  type: "paragraph",
                  value: text,
                },
              ],
            },
          ];
        }

        const messagesWithoutLast = prevMessages.slice(0, -1);

        const updatedLastMessage = {
          ...lastMessage,
          rawContent: [
            ...(lastMessage.rawContent as RawContent),
            {
              type: "paragraph",
              value: text,
            },
          ] as RawContent,
        };

        return [...messagesWithoutLast, updatedLastMessage];
      });
    }

    setIsThinking(false);
  }, []);

  useEffect(() => {
    const lastMessage = messages[messages.length - 1];

    if (lastMessage?.role === "user") {
      triggerGeneration(lastMessage.rawContent as RawContent);
    }
  }, [messages, triggerGeneration]);

  const handleSubmit = async () => {
    setIsThinking(true);

    if (!message) {
      return;
    }

    const newMessageUser: ChatMessage = {
      role: "user",
      createdAt: new Date(),
      rawContent: [
        {
          type: "paragraph",
          value: message,
        },
      ],
      attachments,
    };

    setMessages((prevMessages) => [...prevMessages, newMessageUser]);

    await addMessage.mutateAsync({
      role: "user",
      rawContent: [
        {
          type: "paragraph",
          value: message,
        },
      ],
      attachmentIds: attachments.map((attachment) => attachment.id),
      chatId,
    });

    const result = await simpleAgent(newMessageUser.rawContent as RawContent);

    const newAssistantMessage: ChatMessage = {
      id: createId(),
      role: "assistant",
      rawContent: [],
      createdAt: new Date(),
    };

    for await (const text of readStreamableValue(result)) {
      if (!text) {
        continue;
      }

      setIsThinking(false);

      setMessages((prevMessages) => {
        const lastMessage = prevMessages[prevMessages.length - 1];

        if (!lastMessage) {
          return prevMessages;
        }

        if (lastMessage.role !== "assistant") {
          return [
            ...prevMessages,
            {
              ...newAssistantMessage,
              rawContent: [
                {
                  type: "paragraph",
                  value: text,
                },
              ],
            },
          ];
        }

        const messagesWithoutLast = prevMessages.slice(0, -1);

        const updatedLastMessage = {
          ...lastMessage,
          rawContent: [
            ...(lastMessage.rawContent as RawContent),
            {
              type: "paragraph",
              value: text,
            },
          ] as RawContent,
        };

        return [...messagesWithoutLast, updatedLastMessage];
      });
    }
  };

  return (
    <div className="flex size-full flex-col">
      <Messages messages={messages} isThinking={isThinking} />

      <div className="relative px-2 pb-2">
        <div className="absolute right-0 bottom-full left-0 h-4 bg-gradient-to-t from-muted to-transparent" />
        <MultimodalInput
          chatId={chatId}
          message={message}
          setMessage={setMessage}
          attachments={attachments}
          setAttachments={setAttachments}
          isThinking={isThinking}
          handleSubmit={handleSubmit}
          placeholder="Build with Weldr..."
        />
      </div>
    </div>
  );
}
