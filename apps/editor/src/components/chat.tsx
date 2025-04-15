import { useScrollToBottom } from "@/hooks/use-scroll-to-bottom";
import { useProjectView } from "@/lib/store";
import { api } from "@/lib/trpc/client";
import type { CanvasNode, TPendingMessage, TStreamableValue } from "@/types";
import { createId } from "@paralleldrive/cuid2";
import type { RouterOutputs } from "@weldr/api";
import { authClient } from "@weldr/auth/client";
import type { Attachment, ChatMessage, RawContent } from "@weldr/shared/types";
import { cn } from "@weldr/ui/utils";
import { useReactFlow } from "@xyflow/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Messages } from "./messages";
import { MultimodalInput } from "./multimodal-input";
interface ChatProps {
  initialMessages: ChatMessage[];
  chatId: string;
  integrationTemplates: RouterOutputs["integrationTemplates"]["list"];
  project: RouterOutputs["projects"]["byId"];
}

export function Chat({
  initialMessages,
  chatId,
  integrationTemplates,
  project,
}: ChatProps) {
  const { setSelectedView } = useProjectView();

  const { data: session } = authClient.useSession();
  const generationTriggered = useRef(false);
  const [messagesContainerRef, messagesEndRef] =
    useScrollToBottom<HTMLDivElement>();

  const [pendingMessage, setPendingMessage] = useState<TPendingMessage>(null);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [lastMessage, setLastMessage] = useState<ChatMessage | undefined>(
    messages[messages.length - 1],
  );
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const { getNodes, setNodes, updateNodeData } = useReactFlow<CanvasNode>();

  const addMessage = api.chats.addMessage.useMutation();

  const apiUtils = api.useUtils();

  const triggerGeneration = useCallback(async () => {
    setPendingMessage("thinking");

    const result = await fetch("/api/generate", {
      method: "POST",
      body: JSON.stringify({
        chatId,
        projectId: project.id,
      }),
    });

    if (!result.ok || !result.body) {
      throw new Error("Failed to trigger generation");
    }

    const stream = await readStream(result);

    for await (const chunk of stream) {
      switch (chunk.type) {
        case "paragraph": {
          setPendingMessage(null);

          setMessages((prevMessages) => {
            const lastMessage = prevMessages[prevMessages.length - 1];

            if (lastMessage?.role !== "assistant") {
              return [
                ...prevMessages,
                {
                  id: createId(),
                  role: "assistant",
                  createdAt: new Date(),
                  rawContent: [
                    {
                      type: "paragraph",
                      value: chunk.text,
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
                  value: chunk.text,
                },
              ] as RawContent,
            };

            return [...messagesWithoutLast, updatedLastMessage];
          });
          break;
        }
        case "tool": {
          if (chunk.toolName === "setupIntegrationTool") {
            setPendingMessage("waiting");
            setMessages((prevMessages) => {
              return [
                ...prevMessages,
                {
                  id: chunk.id,
                  role: "tool",
                  createdAt: new Date(),
                  rawContent: {
                    toolName: chunk.toolName,
                    toolArgs: chunk.toolArgs,
                  },
                },
              ];
            });
          }

          if (chunk.toolName === "initializeProjectTool") {
            const status = (
              chunk.toolResult as {
                status: "pending" | "success";
              }
            ).status;

            if (status === "pending") {
              setPendingMessage("building");
            }

            if (status === "success") {
              setPendingMessage(null);
            }
          }

          if (chunk.toolName === "implementTool") {
            const status = (
              chunk.toolResult as {
                status: "pending" | "success";
              }
            ).status;

            if (status === "pending") {
              setPendingMessage("building");
            }

            if (status === "success") {
              setPendingMessage(null);
            }
          }
          break;
        }
        case "version": {
          setMessages((prevMessages) => {
            const lastMessage = prevMessages[prevMessages.length - 1];

            if (lastMessage?.role !== "version") {
              return [
                ...prevMessages,
                {
                  id: chunk.id,
                  role: "version",
                  createdAt: chunk.createdAt ?? new Date(),
                  rawContent: {
                    versionNumber: chunk.versionNumber,
                    versionId: chunk.versionId,
                    versionMessage: chunk.versionMessage,
                    machineId: chunk.machineId,
                    changedFiles: chunk.changedFiles,
                  },
                },
              ];
            }

            const messagesWithoutLast = prevMessages.slice(0, -1);

            return [
              ...messagesWithoutLast,
              {
                ...lastMessage,
                ...chunk,
              },
            ];
          });

          await apiUtils.projects.byId.invalidate({ id: project.id });

          setSelectedView("preview");

          break;
        }
        case "nodes": {
          const nodes = getNodes();
          const existingNode = nodes.find((n) => n.id === chunk.node.id);

          if (existingNode) {
            updateNodeData(existingNode.id, chunk.node);
          } else {
            if (!chunk.node.specs) {
              throw new Error(
                `[chat:${project.id}] No specs found for node ${chunk.node.id}`,
              );
            }

            const newNode = {
              id: chunk.node.id,
              type: `declaration-${chunk.node.specs?.version}` as const,
              position: chunk.node.canvasNode?.position ?? {
                x: 0,
                y: 0,
              },
              data: chunk.node,
            };

            setNodes((prevNodes: CanvasNode[]) => [...prevNodes, newNode]);
          }
          break;
        }
      }
    }

    setPendingMessage(null);
  }, [
    chatId,
    getNodes,
    setNodes,
    updateNodeData,
    project,
    apiUtils,
    setSelectedView,
  ]);

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
      lastMessage.rawContent.toolName === "setupIntegrationTool" &&
      lastMessage.rawContent.toolResult?.status === "pending"
    ) {
      setPendingMessage("waiting");
    }
  }, [messages]);

  const handleSubmit = async () => {
    setPendingMessage("thinking");

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

    await triggerGeneration();
  };

  return (
    <div className="flex size-full flex-col">
      <div
        ref={messagesContainerRef}
        className={cn(
          "scrollbar scrollbar-thumb-rounded-full scrollbar-thumb-muted-foreground scrollbar-track-transparent flex h-full max-h-[calc(100vh-186px)] min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-2",
          pendingMessage && "max-h-[calc(100vh-212px)]",
          attachments.length > 0 && "max-h-[calc(100vh-242px)]",
          pendingMessage &&
            attachments.length > 0 &&
            "max-h-[calc(100vh-268px)]",
        )}
      >
        <Messages
          messages={messages}
          setMessages={setMessages}
          integrationTemplates={integrationTemplates}
          pendingMessage={pendingMessage}
          setPendingMessage={setPendingMessage}
        />
        <div ref={messagesEndRef} />
      </div>

      <div className="relative px-2">
        <div className="absolute right-0 bottom-full left-0 h-4 bg-gradient-to-t from-muted to-transparent" />
        <MultimodalInput
          chatId={chatId}
          message={message}
          setMessage={setMessage}
          attachments={attachments}
          setAttachments={setAttachments}
          pendingMessage={pendingMessage}
          handleSubmit={handleSubmit}
          placeholder="Build with Weldr..."
        />
      </div>
    </div>
  );
}
async function readStream(response: Response) {
  const reader = response.body?.getReader();

  if (!reader) {
    throw new Error("No reader found");
  }

  const stream = {
    async *[Symbol.asyncIterator]() {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const decodedChunk = new TextDecoder().decode(value);
        const lines = decodedChunk.split("|CHUNK|");
        console.log(lines);
        for (const line of lines) {
          if (line.trim() === "") continue;
          const parsedDelta: TStreamableValue = JSON.parse(line);
          yield parsedDelta;
        }
      }
    },
  };

  return stream;
}
