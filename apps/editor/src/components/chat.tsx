import { requirementsEngineer } from "@/lib/ai/agents/requirements-engineer";
import { useProject } from "@/lib/store";
import { api } from "@/lib/trpc/client";
import { createId } from "@paralleldrive/cuid2";
import type { RouterOutputs } from "@weldr/api";
import { authClient } from "@weldr/auth/client";
import type { Attachment, ChatMessage, RawContent } from "@weldr/shared/types";
import { readStreamableValue } from "ai/rsc";
import { useCallback, useEffect, useRef, useState } from "react";
import { Messages } from "./messages";
import { MultimodalInput } from "./multimodal-input";

interface ChatProps {
  initialMessages: ChatMessage[];
  chatId: string;
  integrations: RouterOutputs["integrations"]["list"];
}

export function Chat({ initialMessages, chatId, integrations }: ChatProps) {
  const { project } = useProject();

  const { data: session } = authClient.useSession();

  const [isThinking, setIsThinking] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);

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

    const result = await requirementsEngineer(chatId, project.id);

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
          if (delta.toolName === "setupResource") {
            setIsWaiting(true);
          }

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
  }, [chatId, project.id, apiUtils]);

  useEffect(() => {
    if (lastMessage?.role === "user" && !generationTriggered.current) {
      generationTriggered.current = true;
      setLastMessage(undefined);
      void triggerGeneration().finally(() => {
        generationTriggered.current = false;
      });
    }
  }, [lastMessage, triggerGeneration]);

  useEffect(() => {
    const lastMessage = messages[messages.length - 1];

    if (
      lastMessage?.role === "tool" &&
      lastMessage.rawContent.toolName === "setupResource" &&
      lastMessage.rawContent.toolResult?.status === "pending"
    ) {
      console.log("setting waiting to true");
      setIsWaiting(true);
    }
  }, [messages]);

  const handleSubmit = async () => {
    setIsThinking(true);

    if (!message) {
      return;
    }

    const newMessageUser = {
      id: createId(),
      role: "user",
      createdAt: new Date(),
      rawContent: [
        {
          type: "paragraph",
          value: message,
        },
      ],
      attachments,
      chatId,
      userId: session?.user.id,
      user: session?.user
        ? {
            id: session.user.id,
            name: session.user.name,
            email: session.user.email,
            image: session.user.image ?? undefined,
          }
        : undefined,
    };

    setMessages((prevMessages) => [
      ...prevMessages,
      newMessageUser as ChatMessage,
    ]);

    addMessage.mutate({
      chatId,
      messages: [
        {
          id: newMessageUser.id,
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

    await apiUtils.chats.messages.invalidate({ chatId });

    await triggerGeneration();
  };

  return (
    <div className="flex size-full flex-col">
      <Messages
        messages={messages}
        setMessages={setMessages}
        isThinking={isThinking}
        integrations={integrations}
        isWaiting={isWaiting}
        setIsWaiting={setIsWaiting}
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
