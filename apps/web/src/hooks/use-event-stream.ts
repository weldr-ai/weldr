import { useReactFlow } from "@xyflow/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useProject } from "@/lib/context/project";
import type { CanvasNode } from "@/types";

import type {
  AssistantMessage,
  ChatMessage,
  SSEEvent,
  TPendingMessage,
} from "@weldr/shared/types";

interface UseEventStreamOptions {
  projectId: string;
  project: {
    currentVersion: {
      status: string;
    };
  };
  setPendingMessage: (message: TPendingMessage) => void;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

export function useEventStream({
  projectId,
  project,
  setPendingMessage,
  setMessages,
}: UseEventStreamOptions) {
  const { updateProjectData } = useProject();
  const { getNodes, setNodes, updateNodeData } = useReactFlow<CanvasNode>();

  const [eventSourceRef, setEventSourceRef] = useState<EventSource | null>(
    null,
  );

  // Reconnection tracking
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isConnectingRef = useRef(false);

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

    const eventSource = new EventSource(`/api/chat/${projectId}/stream`, {
      withCredentials: true,
    });
    setEventSourceRef(eventSource);

    eventSource.onmessage = (event) => {
      try {
        // EventSource API should give us clean JSON data directly
        const chunk: SSEEvent = JSON.parse(event.data);
        console.log("Parsed chunk:", chunk);

        if (chunk.type === "connected") {
          reconnectAttempts.current = 0;
          isConnectingRef.current = false;
          console.log(`[SSE] Connected to stream for project ${projectId}`);
          return;
        }

        if (chunk.type === "error") {
          setPendingMessage(null);
          if (eventSource.readyState !== EventSource.CLOSED) {
            eventSource.close();
          }
          setEventSourceRef(null);
          reconnectAttempts.current = 0;
          isConnectingRef.current = false;
          return;
        }

        setPendingMessage("responding");

        switch (chunk.type) {
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
                if (
                  integrationToolResult?.toolCallId ===
                  lastMessage.content[0]?.toolCallId
                ) {
                  const chatWithLastMessage = prevMessages.slice(0, -1);
                  return [...chatWithLastMessage, chunk.message as ChatMessage];
                }
              }
              return [...prevMessages, chunk.message as ChatMessage];
            });
            break;
          }
          case "update_project": {
            updateProjectData({ ...chunk.data });
            const status = chunk.data.currentVersion?.status;

            switch (status) {
              case "pending":
                setPendingMessage(null);
                break;
              case "planning":
                setPendingMessage("planning");
                break;
              case "coding":
                setPendingMessage("coding");
                break;
              case "deploying":
                setPendingMessage("deploying");
                break;
              case "completed":
              case "failed":
                setPendingMessage(null);
                break;
              default:
                setPendingMessage(null);
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
        project.currentVersion.status !== "completed" &&
        project.currentVersion.status !== "failed" &&
        reconnectAttempts.current < maxReconnectAttempts
      ) {
        reconnectAttempts.current += 1;
        const delay = Math.min(1000 * 2 ** reconnectAttempts.current, 10000); // Exponential backoff with max 10s

        reconnectTimeoutRef.current = setTimeout(() => {
          connectToEventStream();
        }, delay);
      } else {
        setPendingMessage(null);
      }
    };

    return eventSource;
  }, [
    projectId,
    project.currentVersion.status,
    setPendingMessage,
    setMessages,
    updateProjectData,
    getNodes,
    setNodes,
    updateNodeData,
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
      project.currentVersion.status !== "completed" &&
      project.currentVersion.status !== "failed"
    ) {
      connectToEventStream();
    }
  }, [eventSourceRef, project.currentVersion.status, connectToEventStream]);

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
