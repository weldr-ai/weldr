import { useCallback } from "react";

import type {
  Attachment,
  TriggerWorkflowResponse,
  TStatus,
  UserMessage,
} from "@weldr/shared/types";

interface UseWorkflowTriggerOptions {
  projectId: string;
  setStatus: (status: TStatus) => void;
  eventSourceRef: EventSource | null;
  connectToEventStream: () => EventSource | null;
}

export function useWorkflowTrigger({
  projectId,
  setStatus,
  eventSourceRef,
  connectToEventStream,
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
      setStatus("thinking");

      try {
        // First trigger the workflow
        await triggerWorkflow(message);

        // Only connect to event stream if we don't already have a connection
        if (!eventSourceRef) {
          connectToEventStream();
        }
      } catch (error) {
        console.error("Failed to start generation:", error);
        setStatus(null);
      }
    },
    [triggerWorkflow, eventSourceRef, connectToEventStream, setStatus],
  );

  return {
    triggerWorkflow,
    triggerGeneration,
  };
}
