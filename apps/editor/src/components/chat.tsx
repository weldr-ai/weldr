import { useScrollToBottom } from "@/hooks/use-scroll-to-bottom";
import { useProjectData, useUIStore } from "@/lib/store";
import { useTRPC } from "@/lib/trpc/react";
import type { CanvasNode, TPendingMessage, TStreamableValue } from "@/types";
import { createId } from "@paralleldrive/cuid2";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { RouterOutputs } from "@weldr/api";
import { authClient } from "@weldr/auth/client";
import type {
  AssistantMessageRawContent,
  Attachment,
  ChatMessage,
  UserMessageRawContent,
} from "@weldr/shared/types";
import type { rawContentReferenceElementSchema } from "@weldr/shared/validators/common";
import { Button } from "@weldr/ui/components/button";
import { cn } from "@weldr/ui/lib/utils";
import { useReactFlow } from "@xyflow/react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { z } from "zod";
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
  const { setProjectView } = useUIStore();
  const { setMachineId } = useProjectData();

  const { data: session } = authClient.useSession();
  const generationTriggered = useRef(false);
  const [messagesContainerRef, messagesEndRef] =
    useScrollToBottom<HTMLDivElement>();
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const currentVersionProgress = project.currentVersion?.progress;

  const [pendingMessage, setPendingMessage] = useState<TPendingMessage>(
    currentVersionProgress === "initiated"
      ? "building"
      : currentVersionProgress === "coded"
        ? "deploying"
        : currentVersionProgress === "deployed"
          ? "enriching"
          : null,
  );

  const [isChatVisible, setIsChatVisible] = useState(false);

  const editorReferences = project.declarations?.reduce(
    (acc, declaration) => {
      switch (declaration.specs?.data.type) {
        case "function": {
          acc.push({
            type: "reference",
            id: declaration.id,
            name: declaration.name,
            referenceType: "function",
          });
          break;
        }
        case "model": {
          acc.push({
            type: "reference",
            id: declaration.id,
            name: declaration.name,
            referenceType: "model",
          });
          break;
        }
        case "component": {
          const subtype = declaration.specs?.data.definition.subtype;
          if (subtype === "page" || subtype === "reusable") {
            acc.push({
              type: "reference",
              id: declaration.id,
              name: declaration.name,
              referenceType: "component",
              subtype,
            });
          }
          break;
        }
        case "endpoint": {
          acc.push({
            type: "reference",
            id: declaration.id,
            name: declaration.name,
            referenceType: "endpoint",
            subtype: declaration.specs?.data.definition.subtype,
          });
          break;
        }
        default: {
          break;
        }
      }

      return acc;
    },
    [] as z.infer<typeof rawContentReferenceElementSchema>[],
  );

  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [userMessageRawContent, setUserMessageRawContent] =
    useState<UserMessageRawContent>([]);
  const [lastMessage, setLastMessage] = useState<ChatMessage | undefined>(
    messages[messages.length - 1],
  );
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const { getNodes, setNodes, updateNodeData } = useReactFlow<CanvasNode>();

  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const addMessage = useMutation(
    trpc.chats.addMessage.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries(
          trpc.chats.messages.queryFilter({ chatId }),
        );
      },
    }),
  );

  const triggerGeneration = useCallback(async () => {
    setPendingMessage(pendingMessage ?? "thinking");

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
      if (pendingMessage === null || pendingMessage === "thinking") {
        setPendingMessage("generating");
      }

      switch (chunk.type) {
        case "paragraph": {
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
              ] as AssistantMessageRawContent,
            };

            return [...messagesWithoutLast, updatedLastMessage];
          });
          break;
        }
        case "coder": {
          if (chunk.status === "initiated") {
            setPendingMessage("building");
            setMachineId(null);
          }

          if (chunk.status === "coded") {
            setPendingMessage("deploying");
          }

          if (chunk.status === "deployed") {
            setPendingMessage("enriching");
            setProjectView("preview");
            setMachineId(chunk.machineId);
          }

          if (chunk.status === "succeeded") {
            await queryClient.invalidateQueries(
              trpc.projects.byId.queryFilter({ id: project.id }),
            );
            setPendingMessage(null);
          }
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
                    versionDescription: chunk.versionDescription,
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
                rawContent: {
                  ...lastMessage.rawContent,
                  ...chunk,
                },
              },
            ];
          });

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
    queryClient,
    trpc,
    setProjectView,
    setMachineId,
    pendingMessage,
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
    if (
      (currentVersionProgress === "initiated" ||
        currentVersionProgress === "deployed" ||
        currentVersionProgress === "coded" ||
        currentVersionProgress === "enriched") &&
      !generationTriggered.current
    ) {
      generationTriggered.current = true;
      void triggerGeneration().finally(() => {
        generationTriggered.current = false;
      });
    }
  }, [currentVersionProgress, triggerGeneration]);

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

    if (userMessageRawContent.length === 0) {
      return;
    }

    const newMessageUser = {
      id: createId(),
      role: "user",
      createdAt: new Date(),
      rawContent: userMessageRawContent,
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

    await addMessage.mutateAsync({
      chatId,
      messages: [
        {
          id: newMessageUser.id,
          role: "user",
          rawContent: userMessageRawContent,
          attachmentIds: attachments.map((attachment) => attachment.id),
        },
      ],
    });

    await triggerGeneration();
  };

  const handleInputFocus = useCallback(() => {
    setIsChatVisible(true);
  }, []);

  // Handle clicks outside the chat container
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Don't hide if there's a pending message (generation in progress)
      if (pendingMessage) {
        return;
      }

      if (
        chatContainerRef.current &&
        !chatContainerRef.current.contains(event.target as Node)
      ) {
        setIsChatVisible(false);
      }
    };

    // Use capture phase to ensure we catch the event before it's stopped
    document.addEventListener("mousedown", handleClickOutside, true);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside, true);
    };
  }, [pendingMessage]);

  return (
    <div
      ref={chatContainerRef}
      className={cn(
        "flex size-full max-h-[400px] flex-col justify-end rounded-lg border bg-background dark:bg-muted",
        {
          "transition-all delay-300 ease-in-out":
            !isChatVisible &&
            pendingMessage !== "thinking" &&
            pendingMessage !== "generating",
          "transition-none":
            attachments.length > 0 ||
            isChatVisible ||
            pendingMessage === "thinking" ||
            pendingMessage === "generating",
        },
      )}
    >
      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out",
          {
            "h-0":
              !isChatVisible &&
              pendingMessage !== "thinking" &&
              pendingMessage !== "generating",
            "h-[300px]":
              isChatVisible ||
              pendingMessage === "thinking" ||
              pendingMessage === "generating",
          },
        )}
      >
        <div className="flex items-center justify-between border-b p-1">
          <span className="font-medium text-xs">Chat Title</span>
          <div className="flex items-center gap-0.5">
            <Button
              variant="outline"
              className="size-5 rounded-sm shadow-none"
              size="icon"
            >
              <ChevronLeftIcon className="size-3" />
            </Button>
            <Button
              variant="outline"
              className="size-5 rounded-sm shadow-none"
              size="icon"
            >
              <ChevronRightIcon className="size-3" />
            </Button>
          </div>
        </div>
        <div
          ref={messagesContainerRef}
          className="scrollbar scrollbar-thumb-rounded-full scrollbar-thumb-muted-foreground scrollbar-track-transparent flex h-[calc(100%-29px)] flex-col gap-2 overflow-y-auto border-b p-2"
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
      </div>

      <MultimodalInput
        type="editor"
        chatId={chatId}
        message={userMessageRawContent}
        setMessage={setUserMessageRawContent}
        attachments={attachments}
        setAttachments={setAttachments}
        pendingMessage={pendingMessage}
        handleSubmit={handleSubmit}
        placeholder="Build with Weldr..."
        references={editorReferences}
        onFocus={handleInputFocus}
        isVisible={isChatVisible}
      />
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
