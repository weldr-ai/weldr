import { requirementsGatherer } from "@/lib/ai/agents/requirements-gatherer";
import { useProject } from "@/lib/store";
import { api } from "@/lib/trpc/client";
import type { CanvasNode, TPendingMessage } from "@/types";
import { createId } from "@paralleldrive/cuid2";
import { authClient } from "@weldr/auth/client";
import type { Attachment, ChatMessage, RawContent } from "@weldr/shared/types";
import { useReactFlow } from "@xyflow/react";
import { readStreamableValue } from "ai/rsc";
import { useCallback, useEffect, useRef, useState } from "react";
import { Messages } from "./messages";
import { MultimodalInput } from "./multimodal-input";

interface ChatProps {
  initialMessages: ChatMessage[];
  chatId: string;
  // integrations: RouterOutputs["integrations"]["list"];
}

export function Chat({
  initialMessages,
  chatId,
  // integrations
}: ChatProps) {
  const { data: session } = authClient.useSession();
  const generationTriggered = useRef(false);

  const { project, setProject } = useProject();
  const [pendingMessage, setPendingMessage] = useState<TPendingMessage>(null);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [lastMessage, setLastMessage] = useState<ChatMessage | undefined>(
    messages[messages.length - 1],
  );
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const { getNodes, getNode, setNodes, updateNodeData } =
    useReactFlow<CanvasNode>();

  const addMessage = api.chats.addMessage.useMutation();

  const apiUtils = api.useUtils();

  const triggerGeneration = useCallback(async () => {
    setPendingMessage("thinking");

    const result = await requirementsGatherer({
      chatId,
      projectId: project.id,
    });

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

      switch (delta.type) {
        case "text": {
          setPendingMessage(null);

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
          if (delta.toolName === "setupResourceTool") {
            setPendingMessage("waiting");
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
          }

          if (delta.toolName === "initializeProjectTool") {
            const status = (
              delta.toolResult as {
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

          if (delta.toolName === "implementTool") {
            const status = (
              delta.toolResult as {
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
            return [
              ...prevMessages,
              {
                id: delta.id,
                role: "version",
                createdAt: new Date(),
                rawContent: {
                  versionNumber: delta.versionNumber,
                  versionId: delta.versionId,
                  versionMessage: delta.versionMessage,
                },
              },
            ];
          });

          setProject({
            ...project,
            currentVersion: {
              id: delta.versionId,
              number: delta.versionNumber,
              message: delta.versionMessage,
              machineId: delta.machineId,
            },
          });

          await apiUtils.projects.byId.invalidate({
            id: project.id,
            currentVersionId: delta.versionId,
          });

          const previewNode = getNode("preview");

          if (!previewNode) {
            setNodes((prevNodes) => [
              ...prevNodes,
              {
                id: "preview",
                type: "preview",
                position: {
                  x: 0,
                  y: 0,
                },
                data: {
                  type: "preview",
                  projectId: project.id,
                  machineId: delta.machineId,
                },
              },
            ]);
          }

          break;
        }
        case "code": {
          setMessages((prevMessages) => {
            const lastMessage = prevMessages[prevMessages.length - 1];

            if (lastMessage?.role !== "code") {
              return [
                ...prevMessages,
                {
                  id: delta.id,
                  role: "code",
                  createdAt: new Date(),
                  rawContent: delta.files,
                },
              ];
            }

            const messagesWithoutLast = prevMessages.slice(0, -1);

            const updatedLastMessage = {
              ...lastMessage,
              rawContent: {
                ...lastMessage.rawContent,
                ...delta.files,
              },
            };

            return [...messagesWithoutLast, updatedLastMessage];
          });
          break;
        }
        case "nodes": {
          const nodes = getNodes();
          const existingNode = nodes.find((n) => n.id === delta.node.id);

          if (existingNode) {
            updateNodeData(existingNode.id, delta.node);
          } else {
            const newNode = {
              id: delta.node.id,
              type: "declaration" as const,
              position: delta.node.canvasNode?.position ?? {
                x: 0,
                y: 0,
              },
              data: delta.node,
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
    getNode,
    setNodes,
    updateNodeData,
    project,
    setProject,
    apiUtils,
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
      lastMessage.rawContent.toolName === "setupResource" &&
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
      <Messages
        messages={messages}
        setMessages={setMessages}
        // integrations={integrations}
        pendingMessage={pendingMessage}
        setPendingMessage={setPendingMessage}
      />

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
