import { useQueryClient } from "@tanstack/react-query";
import { useReactFlow } from "@xyflow/react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { RouterOutputs } from "@weldr/api";
import type {
  AssistantMessage,
  ChatMessage,
  SSEEvent,
  TStatus,
} from "@weldr/shared/types";

import { useTRPC } from "@/lib/trpc/react";
import type { CanvasNode } from "@/types";

interface UseEventStreamOptions {
  projectId: string;
  branchId: string;
  chatId: string;
  project: RouterOutputs["projects"]["byId"];
  setStatus: (status: TStatus) => void;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

export function useEventStream({
  projectId,
  branchId,
  chatId,
  project,
  setStatus,
  setMessages,
}: UseEventStreamOptions) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { getNodes, setNodes, updateNodeData } = useReactFlow<CanvasNode>();

  const [eventSourceRef, setEventSourceRef] = useState<EventSource | null>(
    null,
  );

  // Reconnection tracking
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isConnectingRef = useRef(false);
  const lastEventIdRef = useRef<string | null>(null);

  const connectToEventStream = useCallback(() => {
    // Prevent multiple simultaneous connections
    if (eventSourceRef || isConnectingRef.current) {
      return eventSourceRef;
    }

    // Mark as connecting to prevent race conditions
    isConnectingRef.current = true;

    // Clear any pending reconnection timeout before creating new connection
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Build URL with branchId in path and Last-Event-ID as query parameter
    let url = `/api/chat/${projectId}/${branchId}/stream`;
    if (lastEventIdRef.current) {
      url += `?lastEventId=${encodeURIComponent(lastEventIdRef.current)}`;
    }

    const eventSource = new EventSource(url, {
      withCredentials: true,
    });
    setEventSourceRef(eventSource);

    eventSource.onmessage = (event) => {
      try {
        // EventSource API should give us clean JSON data directly
        const chunk: SSEEvent = JSON.parse(event.data);

        if (chunk.type === "connected") {
          reconnectAttempts.current = 0;
          isConnectingRef.current = false;
          console.log(`[SSE] Connected to stream for project ${projectId}`);
          return;
        }

        // Track the event ID if present for reconnection
        if (chunk.id) {
          lastEventIdRef.current = chunk.id;
        }

        if (chunk.type === "error") {
          setStatus(null);
          if (eventSource.readyState !== EventSource.CLOSED) {
            eventSource.close();
          }
          setEventSourceRef(null);
          reconnectAttempts.current = 0;
          isConnectingRef.current = false;
          return;
        }

        setStatus("responding");

        switch (chunk.type) {
          case "status": {
            setStatus(chunk.status);
            break;
          }
          case "text": {
            setMessages((prevMessages) => {
              const lastMessage = prevMessages[prevMessages.length - 1];

              // Only append to the last message if it's an assistant message with the same ID
              if (
                lastMessage?.role === "assistant" &&
                lastMessage.id === chunk.id
              ) {
                const messagesWithoutLast = prevMessages.slice(0, -1);
                const updatedContent = [...lastMessage.content];
                const lastContentItem =
                  updatedContent[updatedContent.length - 1];

                if (lastContentItem && lastContentItem.type === "text") {
                  updatedContent[updatedContent.length - 1] = {
                    ...lastContentItem,
                    text: lastContentItem.text + chunk.text,
                  };
                } else {
                  updatedContent.push({
                    type: "text",
                    text: chunk.text,
                  });
                }

                const updatedLastMessage = {
                  ...lastMessage,
                  content: updatedContent as AssistantMessage["content"],
                };
                return [...messagesWithoutLast, updatedLastMessage];
              }

              // Create a new assistant message if no matching message exists
              return [
                ...prevMessages,
                {
                  id: chunk.id,
                  role: "assistant",
                  chatId,
                  createdAt: new Date(),
                  content: [
                    {
                      type: "text",
                      text: chunk.text,
                    },
                  ],
                },
              ];
            });
            break;
          }
          case "tool-call": {
            console.log("tool-call", chunk);
            setMessages((prevMessages) => {
              const lastMessage = prevMessages[prevMessages.length - 1];
              if (lastMessage?.id === chunk.id) {
                const chatWithLastMessage = prevMessages.slice(0, -1);
                return [
                  ...chatWithLastMessage,
                  {
                    id: chunk.id,
                    role: "assistant",
                    createdAt: lastMessage.createdAt,
                    chatId: lastMessage.chatId,
                    content: [
                      ...(lastMessage.content.filter(
                        (content) =>
                          content.type !== "tool-call" ||
                          content.toolCallId !== chunk.toolCallId,
                      ) as AssistantMessage["content"]),
                      {
                        type: "tool-call",
                        toolCallId: chunk.toolCallId,
                        toolName: chunk.toolName,
                        input: chunk.input,
                      },
                    ],
                  },
                ];
              }
              return [
                ...prevMessages,
                {
                  id: chunk.id,
                  role: "assistant",
                  createdAt: new Date(),
                  chatId,
                  content: [
                    {
                      type: "tool-call",
                      toolCallId: chunk.toolCallId,
                      toolName: chunk.toolName,
                      input: chunk.input,
                    },
                  ],
                },
              ];
            });
            break;
          }
          case "tool": {
            setMessages((prevMessages) => {
              const lastMessage = prevMessages[prevMessages.length - 1];
              if (lastMessage?.role === "tool") {
                const integrationToolResult = chunk.message.content.find(
                  (content) =>
                    content.type === "tool-result" &&
                    content.toolName === "add_integrations",
                );
                if (integrationToolResult) {
                  const chatWithLastMessage = prevMessages.slice(0, -1);
                  return [...chatWithLastMessage, chunk.message as ChatMessage];
                }
              }
              return [...prevMessages, chunk.message as ChatMessage];
            });
            break;
          }
          case "update_project": {
            // Update the project data in the query cache
            queryClient.setQueryData(
              trpc.projects.byId.queryKey({ id: projectId }),
              // @ts-expect-error
              (old) => {
                if (!old) return old;
                return {
                  ...old,
                  title: chunk.data.title,
                  description: chunk.data.description,
                  branch: {
                    ...old.branch,
                    headVersion: {
                      ...old.branch.headVersion,
                      message: chunk.data.branch?.headVersion?.message ?? null,
                      description:
                        chunk.data.branch?.headVersion?.description ?? null,
                      status: chunk.data.branch?.headVersion?.status ?? null,
                    },
                  },
                };
              },
            );

            // Invalidate the query to ensure the data is fresh
            queryClient.invalidateQueries({
              queryKey: trpc.projects.byId.queryKey({ id: projectId }),
            });

            const status = chunk.data.branch?.headVersion?.status;

            switch (status) {
              case "pending":
                setStatus(null);
                break;
              case "planning":
                setStatus("planning");
                break;
              case "coding":
                setStatus("coding");
                break;
              case "deploying":
                setStatus("deploying");
                break;
              case "completed":
              case "failed":
                setStatus(null);
                break;
              default:
                setStatus(null);
                break;
            }
            break;
          }
          case "node": {
            const nodes = getNodes();
            const existingNode = nodes.find((n) => n.id === chunk.nodeId);

            if (existingNode) {
              updateNodeData(existingNode.id, {
                ...existingNode.data,
                metadata: chunk.metadata,
                progress: chunk.progress,
              });
            } else {
              if (!chunk.metadata) {
                throw new Error(
                  `[chat:${projectId}] No specs found for node ${chunk.nodeId}`,
                );
              }

              const newNode = {
                id: chunk.nodeId,
                type: chunk.metadata.specs?.type,
                position: chunk.position,
                data: {
                  id: chunk.nodeId,
                  metadata: chunk.metadata,
                  progress: chunk.progress,
                  nodeId: chunk.nodeId,
                  node: chunk.node,
                },
              } satisfies CanvasNode;

              setNodes((prevNodes: CanvasNode[]) => [
                ...prevNodes,
                newNode as CanvasNode,
              ]);
            }
            break;
          }
          case "end": {
            setStatus(null);
            return;
          }
        }
      } catch (error) {
        console.error("Error parsing SSE message:", error);
      }
    };

    eventSource.onerror = (error) => {
      console.error("SSE connection error:", error);

      // Clear connecting flag
      isConnectingRef.current = false;

      // Ensure connection is properly closed and state is cleaned up
      if (eventSource.readyState !== EventSource.CLOSED) {
        eventSource.close();
      }
      setEventSourceRef(null);

      // Clear any pending reconnection timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      // Only retry if workflow is still active and we haven't exceeded max attempts
      if (
        project.branch.headVersion.status !== "completed" &&
        project.branch.headVersion.status !== "failed" &&
        reconnectAttempts.current < maxReconnectAttempts
      ) {
        reconnectAttempts.current += 1;
        const delay = Math.min(1000 * 2 ** reconnectAttempts.current, 10000); // Exponential backoff with max 10s

        reconnectTimeoutRef.current = setTimeout(() => {
          connectToEventStream();
        }, delay);
      } else {
        setStatus(null);
      }
    };

    return eventSource;
  }, [
    projectId,
    branchId,
    project.branch.headVersion.status,
    setStatus,
    setMessages,
    getNodes,
    setNodes,
    updateNodeData,
    queryClient,
    chatId,
    trpc,
  ]);

  const closeEventStream = useCallback(() => {
    // Reset reconnection attempts and connecting flag
    reconnectAttempts.current = 0;
    isConnectingRef.current = false;

    // Clear any pending timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Close EventSource connection if it exists and is not already closed
    if (eventSourceRef) {
      if (eventSourceRef.readyState !== EventSource.CLOSED) {
        eventSourceRef.close();
      }
      setEventSourceRef(null);
    }
  }, [eventSourceRef]);

  // Auto-connect to event stream on mount if workflow is active
  useEffect(() => {
    // Only connect if there's no existing connection and workflow might be active
    if (
      !eventSourceRef &&
      project.branch.headVersion.status !== "completed" &&
      project.branch.headVersion.status !== "failed"
    ) {
      connectToEventStream();
    }
  }, [eventSourceRef, project.branch.headVersion.status, connectToEventStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      closeEventStream();
    };
  }, [closeEventStream]);

  return {
    eventSourceRef,
    connectToEventStream,
    closeEventStream,
  };
}
