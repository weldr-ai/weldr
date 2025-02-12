import { manager } from "@/lib/ai/agents/manager";
import { api } from "@/lib/trpc/client";
import { createId } from "@paralleldrive/cuid2";
import type { RouterOutputs } from "@weldr/api";
import type { Attachment, ChatMessage, RawContent } from "@weldr/shared/types";
import { readStreamableValue } from "ai/rsc";
import { useCallback, useEffect, useRef, useState } from "react";
import { Messages } from "./messages";
import { MultimodalInput } from "./multimodal-input";
interface ChatProps {
  initialMessages: ChatMessage[];
  chatId: string;
  projectId: string;
  integrations: RouterOutputs["integrations"]["list"];
}

export function Chat({
  initialMessages,
  chatId,
  projectId,
  integrations,
}: ChatProps) {
  const [isThinking, setIsThinking] = useState(false);

  const apiUtils = api.useUtils();

  const addMessage = api.chats.addMessage.useMutation();

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [lastMessage, setLastMessage] = useState<ChatMessage | undefined>(
    messages[messages.length - 1],
  );

  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const generationTriggered = useRef(false);

  const triggerGeneration = useCallback(async () => {
    setIsThinking(true);

    const result = await manager(chatId, projectId);

    console.log(result);

    const newAssistantMessage: ChatMessage = {
      id: createId(),
      role: "assistant",
      rawContent: [],
      createdAt: new Date(),
    };

    for await (const delta of readStreamableValue(result)) {
      if (!delta) {
        continue;
      }

      setIsThinking(false);

      switch (delta.type) {
        case "text": {
          setMessages((prevMessages) => {
            const lastMessage = prevMessages[prevMessages.length - 1];

            if (lastMessage?.role !== "assistant") {
              return [
                ...prevMessages,
                {
                  ...newAssistantMessage,
                  rawContent: [
                    {
                      type: "paragraph",
                      value: delta.text,
                    },
                  ],
                },
              ];
            }

            const messagesWithoutLast = prevMessages.slice(0, -1);

            const updatedLastMessage = {
              ...lastMessage,
              rawContent: [
                ...lastMessage.rawContent,
                {
                  type: "paragraph",
                  value: delta.text,
                },
              ] as RawContent,
            };

            return [...messagesWithoutLast, updatedLastMessage];
          });
          break;
        }
        case "tool": {
          setMessages((prevMessages) => {
            return [
              ...prevMessages,
              {
                id: createId(),
                role: "tool",
                createdAt: new Date(),
                rawContent: {
                  toolName: delta.toolName,
                  toolArgs: delta.toolArgs,
                },
              },
            ];
          });
          break;
        }
      }
    }

    await apiUtils.chats.messages.invalidate({ chatId });

    setIsThinking(false);
  }, [chatId, projectId, apiUtils]);

  useEffect(() => {
    if (lastMessage?.role === "user" && !generationTriggered.current) {
      generationTriggered.current = true;
      setLastMessage(undefined);
      void triggerGeneration().finally(() => {
        generationTriggered.current = false;
      });
    }
  }, [lastMessage, triggerGeneration]);

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
      chatId,
      messages: [
        {
          role: "user",
          rawContent: [
            {
              type: "paragraph",
              value: message,
            },
          ],
          attachmentIds: attachments.map((attachment) => attachment.id),
        },
      ],
    });

    await triggerGeneration();
  };

  return (
    <div className="flex size-full flex-col">
      <Messages
        messages={messages}
        isThinking={isThinking}
        integrations={integrations}
      />

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
