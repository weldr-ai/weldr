import { useEffect, useState } from "react";

import type { RouterOutputs } from "@weldr/api";
import type {
  ChatMessage,
  IntegrationCategoryKey,
  ToolResultPartMessage,
  TPendingMessage,
} from "@weldr/shared/types";

interface UsePendingMessageStatusOptions {
  version: RouterOutputs["projects"]["byId"]["currentVersion"];
  messages: ChatMessage[];
  project: {
    integrations: Array<{
      integrationTemplate: {
        category: {
          key: IntegrationCategoryKey;
        };
      };
    }>;
  };
}

export function usePendingMessageStatus({
  version,
  messages,
  project,
}: UsePendingMessageStatusOptions) {
  const getInitialPendingMessage = (): TPendingMessage => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === "user" && version.status === "pending") {
      return "thinking";
    }
    return null;
  };

  const [pendingMessage, setPendingMessage] = useState<TPendingMessage>(
    getInitialPendingMessage(),
  );

  // Handle version status changes
  useEffect(() => {
    switch (version.status) {
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
  }, [version.status]);

  // Handle integration setup waiting state
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === "tool") {
      const installedCategories = project.integrations.map(
        (integration) => integration.integrationTemplate.category.key,
      );

      const toolResult = lastMessage.content.find(
        (content) =>
          content.type === "tool-result" &&
          content.toolName === "add_integrations",
      ) as ToolResultPartMessage & {
        output: {
          status: "awaiting_config";
          categories: IntegrationCategoryKey[];
        };
      };

      if (
        toolResult?.output?.status === "awaiting_config" &&
        toolResult?.output?.categories.some(
          (category) => !installedCategories.includes(category),
        )
      ) {
        setPendingMessage("waiting");
      }
    }
  }, [messages, project.integrations]);

  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (
      lastMessage?.role === "user" &&
      version.status === "pending" &&
      !pendingMessage
    ) {
      setPendingMessage("thinking");
    }
  }, [messages, version.status, pendingMessage]);

  return {
    pendingMessage,
    setPendingMessage,
  };
}
