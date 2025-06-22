import { useScrollToBottom } from "@/hooks/use-scroll-to-bottom";
import { useTRPC } from "@/lib/trpc/react";
import type {
  CanvasNode,
  SSEEvent,
  TPendingMessage,
  TriggerWorkflowResponse,
} from "@/types";
import { useQueryClient } from "@tanstack/react-query";
import type { RouterOutputs } from "@weldr/api";
import { authClient } from "@weldr/auth/client";
import { nanoid } from "@weldr/shared/nanoid";
import type {
  AssistantMessage,
  Attachment,
  ChatMessage,
  UserMessage,
} from "@weldr/shared/types";
import type { referencePartSchema } from "@weldr/shared/validators/chats";
import { Button } from "@weldr/ui/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@weldr/ui/components/tooltip";
import { cn } from "@weldr/ui/lib/utils";
import { useReactFlow } from "@xyflow/react";
import { ChevronLeftIcon, ChevronRightIcon, GitGraphIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { z } from "zod";
import { Messages } from "./messages";
import { MultimodalInput } from "./multimodal-input";

interface ChatProps {
  version: RouterOutputs["projects"]["byId"]["activeVersion"];
  integrationTemplates: RouterOutputs["integrationTemplates"]["list"];
  environmentVariables: RouterOutputs["environmentVariables"]["list"];
  project: RouterOutputs["projects"]["byId"];
}

export function Chat({
  version,
  integrationTemplates,
  environmentVariables,
  project,
}: ChatProps) {
  const { data: session } = authClient.useSession();
  const [messagesContainerRef, messagesEndRef] =
    useScrollToBottom<HTMLDivElement>();
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const [pendingMessage, setPendingMessage] = useState<TPendingMessage>(null);

  const [isChatVisible, setIsChatVisible] = useState(
    project.activeVersion.progress !== "succeeded",
  );

  const [eventSourceRef, setEventSourceRef] = useState<EventSource | null>(
    null,
  );

  // Add reconnection tracking
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get declarations from the latest generation
  const latestVersion = project.versions[project.versions.length - 1];
  const editorReferences =
    latestVersion?.declarations?.reduce(
      (acc: z.infer<typeof referencePartSchema>[], declaration) => {
        switch (declaration.declaration.specs?.data.type) {
          case "function": {
            acc.push({
              type: "reference:function",
              id: declaration.declaration.id,
              name: declaration.declaration.name,
            });
            break;
          }
          case "model": {
            acc.push({
              type: "reference:model",
              id: declaration.declaration.id,
              name: declaration.declaration.name,
            });
            break;
          }
          case "component": {
            const subtype =
              declaration.declaration.specs?.data.definition.subtype;
            if (subtype === "page" || subtype === "reusable") {
              acc.push({
                type: "reference:component",
                id: declaration.declaration.id,
                name: declaration.declaration.name,
                subtype,
              });
            }
            break;
          }
          case "endpoint": {
            acc.push({
              type: "reference:endpoint",
              id: declaration.declaration.id,
              name: declaration.declaration.name,
            });
            break;
          }
          default: {
            break;
          }
        }

        return acc;
      },
      [] as z.infer<typeof referencePartSchema>[],
    ) ?? [];

  const [messages, setMessages] = useState<ChatMessage[]>(
    version.progress === "succeeded" ? [] : version.chat.messages,
  );
  const [userMessageContent, setUserMessageContent] = useState<
    UserMessage["content"]
  >([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const { getNodes, setNodes, updateNodeData } = useReactFlow<CanvasNode>();

  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const triggerWorkflow = useCallback(
    async (
      messageContent: UserMessage["content"],
      messageAttachments: Attachment[],
    ) => {
      try {
        const triggerResponse = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            projectId: project.id,
            message: {
              content: messageContent,
              attachments: messageAttachments,
            },
          }),
        });

        if (!triggerResponse.ok) {
          throw new Error("Failed to trigger workflow");
        }

        const triggerResult: TriggerWorkflowResponse =
          await triggerResponse.json();
        console.log("Workflow triggered:", triggerResult);
        return triggerResult;
      } catch (error) {
        console.error("Failed to trigger workflow:", error);
        throw error;
      }
    },
    [project.id],
  );

  const connectToEventStream = useCallback(() => {
    // Prevent multiple simultaneous connections
    if (eventSourceRef) {
      console.log("EventSource already exists, skipping connection");
      return eventSourceRef;
    }

    console.log("Connecting to EventSource for project:", project.id);
    const eventSource = new EventSource(`/api/chat/${project.id}`);
    setEventSourceRef(eventSource);

    eventSource.onmessage = (event) => {
      try {
        const chunk: SSEEvent = JSON.parse(event.data);

        if (chunk.type === "connected") {
          console.log(
            `Connected to stream ${chunk.streamId} with client ${chunk.clientId}`,
          );
          // Reset reconnection attempts on successful connection
          reconnectAttempts.current = 0;
          return;
        }

        if (chunk.type === "workflow_complete") {
          setPendingMessage(null);
          eventSource.close();
          setEventSourceRef(null);
          return;
        }

        if (chunk.type === "error") {
          console.error("Workflow error:", chunk.error);
          setPendingMessage(null);
          eventSource.close();
          setEventSourceRef(null);
          return;
        }

        if (pendingMessage === null || pendingMessage === "thinking") {
          setPendingMessage("generating");
        }

        switch (chunk.type) {
          case "text": {
            setMessages((prevMessages) => {
              const lastMessage = prevMessages[prevMessages.length - 1];

              if (lastMessage?.role !== "assistant") {
                return [
                  ...prevMessages,
                  {
                    id: nanoid(),
                    visibility: "public",
                    role: "assistant",
                    createdAt: new Date(),
                    content: [
                      {
                        type: "text",
                        text: chunk.text,
                      },
                    ],
                  },
                ];
              }

              const messagesWithoutLast = prevMessages.slice(0, -1);

              const updatedLastMessage = {
                ...lastMessage,
                content: [
                  ...lastMessage.content,
                  {
                    type: "text",
                    text: chunk.text,
                  },
                ] as AssistantMessage["content"],
              };

              return [...messagesWithoutLast, updatedLastMessage];
            });
            break;
          }
          case "coder": {
            if (chunk.status === "initiated") {
              setPendingMessage("building");
            }

            if (chunk.status === "coded") {
              setPendingMessage("deploying");
            }

            if (chunk.status === "deployed") {
              setPendingMessage("enriching");
            }

            if (chunk.status === "succeeded") {
              queryClient.invalidateQueries(
                trpc.projects.byId.queryFilter({ id: project.id }),
              );
              setPendingMessage(null);
            }
            break;
          }
          case "tool": {
            if (chunk.toolName === "setup_integration") {
              setPendingMessage("waiting");
              setMessages((prevMessages) => {
                return [
                  ...prevMessages,
                  {
                    id: chunk.id,
                    visibility: "public",
                    role: "tool",
                    createdAt: new Date(),
                    content: [
                      {
                        type: "tool-result",
                        toolName: chunk.toolName,
                        result: chunk.toolResult,
                      },
                    ],
                  },
                ];
              });
            }

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

              setNodes((prevNodes: CanvasNode[]) => [
                ...prevNodes,
                newNode as CanvasNode,
              ]);
            }
            break;
          }
          case "end": {
            setPendingMessage(null);
            return;
          }
        }
      } catch (error) {
        console.error("Error parsing SSE message:", error);
      }
    };

    eventSource.onerror = (error) => {
      console.error("SSE connection error:", error);
      eventSource.close();
      setEventSourceRef(null);

      // Clear any pending reconnection timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      // Only retry if workflow is still active and we haven't exceeded max attempts
      if (
        project.activeVersion.progress !== "succeeded" &&
        reconnectAttempts.current < maxReconnectAttempts
      ) {
        reconnectAttempts.current += 1;
        const delay = Math.min(1000 * 2 ** reconnectAttempts.current, 10000); // Exponential backoff with max 10s

        console.log(
          `Attempting to reconnect (${reconnectAttempts.current}/${maxReconnectAttempts}) in ${delay}ms`,
        );

        reconnectTimeoutRef.current = setTimeout(() => {
          connectToEventStream();
        }, delay);
      } else {
        console.log("Max reconnection attempts reached or workflow completed");
      }
    };

    eventSource.onopen = () => {
      console.log("SSE connection opened");
    };

    return eventSource;
  }, [
    project.id,
    project.activeVersion.progress,
    getNodes,
    setNodes,
    updateNodeData,
    queryClient,
    trpc,
    pendingMessage,
  ]);

  const triggerGeneration = useCallback(async () => {
    setPendingMessage("thinking");

    try {
      // First trigger the workflow
      await triggerWorkflow(userMessageContent, attachments);

      // Then connect to event stream
      connectToEventStream();
    } catch (error) {
      console.error("Failed to start generation:", error);
      setPendingMessage(null);
    }
  }, [triggerWorkflow, connectToEventStream, userMessageContent, attachments]);

  // Auto-connect to SSE when component mounts if workflow is active
  useEffect(() => {
    if (project.activeVersion.progress !== "succeeded" && !eventSourceRef) {
      connectToEventStream();
    }
  }, [project.activeVersion.progress]);

  // Cleanup SSE connection and timeouts on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef) {
        eventSourceRef.close();
        setEventSourceRef(null);
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (
      lastMessage?.role === "tool" &&
      lastMessage.content.find(
        (content) =>
          content.type === "tool-result" &&
          content.toolName === "setupIntegrationsTool" &&
          (content.result as { status: "pending" }).status === "pending",
      ) !== undefined
    ) {
      setPendingMessage("waiting");
    }
  }, [messages]);

  const handleSubmit = async () => {
    if (userMessageContent.length === 0) {
      return;
    }

    // Create the user message for local state
    const newMessageUser = {
      id: nanoid(),
      role: "user",
      createdAt: new Date(),
      content: userMessageContent,
      attachments,
      chatId: version.chat.id,
      userId: session?.user.id,
      user: session?.user
        ? {
            id: session.user.id,
            name: session.user.name,
            email: session.user.email,
            image: session.user.image ?? undefined,
          }
        : undefined,
    } as ChatMessage;

    // Add to local state immediately for better UX
    setMessages((prevMessages) => [...prevMessages, newMessageUser]);

    // Clear the input
    setUserMessageContent([]);
    setAttachments([]);

    // Trigger the generation (which will save the message and start workflow)
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
        <div className="flex items-center justify-between border-b p-1 pl-1.5">
          <span className="font-medium text-xs">Chat Title</span>
          <div className="flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  className="size-5 rounded-sm shadow-none"
                  size="icon"
                >
                  <ChevronLeftIcon className="size-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="border bg-background px-2 py-0.5 text-foreground dark:bg-muted">
                <p>View Previous Versions</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  className="size-5 rounded-sm shadow-none"
                  size="icon"
                >
                  <ChevronRightIcon className="size-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="border bg-background px-2 py-0.5 text-foreground dark:bg-muted">
                <p>View Previous Versions</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  className="size-5 rounded-sm shadow-none"
                  size="icon"
                >
                  <GitGraphIcon className="size-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="border bg-background px-2 py-0.5 text-foreground dark:bg-muted">
                <p>View Version History</p>
              </TooltipContent>
            </Tooltip>
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
            environmentVariables={environmentVariables}
            pendingMessage={pendingMessage}
            setPendingMessage={setPendingMessage}
          />
          <div ref={messagesEndRef} />
        </div>
      </div>

      <MultimodalInput
        type="editor"
        chatId={version.chat.id}
        message={userMessageContent}
        setMessage={setUserMessageContent}
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
