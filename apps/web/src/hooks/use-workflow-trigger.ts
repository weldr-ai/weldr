import { useCallback, useEffect, useRef } from "react";

import type {
  Attachment,
  ChatMessage,
  TPendingMessage,
  TriggerWorkflowResponse,
  UserMessage,
} from "@weldr/shared/types";

interface UseWorkflowTriggerOptions {
  projectId: string;
  setPendingMessage: (message: TPendingMessage) => void;
  eventSourceRef: EventSource | null;
  connectToEventStream: () => EventSource | null;
  messages: ChatMessage[];
  pendingMessage: TPendingMessage;
}

export function useWorkflowTrigger({
  projectId,
  setPendingMessage,
  eventSourceRef,
  connectToEventStream,
  messages,
  pendingMessage,
}: UseWorkflowTriggerOptions) {
  const triggerWorkflow = useCallback(
    async (message?: {
      content: UserMessage["content"];
      attachments: Attachment[];
    }) => {
      try {
        const triggerResponse = await fetch(`/api/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            projectId,
            message,
          }),
        });

        if (!triggerResponse.ok) {
          throw new Error("Failed to trigger workflow");
        }

        const triggerResult: TriggerWorkflowResponse =
          await triggerResponse.json();
        return triggerResult;
      } catch (error) {
        console.error("Failed to trigger workflow:", error);
        throw error;
      }
    },
    [projectId],
  );

  const triggerGeneration = useCallback(
    async (message?: {
      content: UserMessage["content"];
      attachments: Attachment[];
    }) => {
      setPendingMessage("thinking");

      try {
        // First trigger the workflow
        await triggerWorkflow(message);

        // Only connect to event stream if we don't already have a connection
        if (!eventSourceRef) {
          connectToEventStream();
        }
      } catch (error) {
        console.error("Failed to start generation:", error);
        setPendingMessage(null);
      }
    },
    [triggerWorkflow, eventSourceRef, connectToEventStream, setPendingMessage],
  );

  // Track if we've already triggered on mount to prevent multiple triggers
  const hasTriggeredOnMount = useRef(false);

  // Auto-trigger workflow on mount if last message is from user
  useEffect(() => {
    // Only trigger once on mount
    if (hasTriggeredOnMount.current) {
      return;
    }

    // Check if there are messages and the last one is from a user
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === "user" && !pendingMessage) {
      hasTriggeredOnMount.current = true;
      triggerGeneration();
    }
  }, [messages, pendingMessage, triggerGeneration]);

  return {
    triggerWorkflow,
    triggerGeneration,
  };
}
