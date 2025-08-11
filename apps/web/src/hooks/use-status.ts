import { useEffect, useState } from "react";

import type { RouterOutputs } from "@weldr/api";
import type {
  ChatMessage,
  IntegrationCategoryKey,
  ToolResultPartMessage,
  TStatus,
} from "@weldr/shared/types";

interface UseStatusOptions {
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

export function useStatus({ version, messages, project }: UseStatusOptions) {
  const getInitialPendingMessage = (): TStatus => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === "user" && version.status === "pending") {
      return "thinking";
    }
    return null;
  };

  const [status, setStatus] = useState<TStatus>(getInitialPendingMessage());

  // Handle version status changes
  useEffect(() => {
    switch (version.status) {
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
        setStatus("waiting");
      }
    }
  }, [messages, project.integrations]);

  return {
    status,
    setStatus,
  };
}
