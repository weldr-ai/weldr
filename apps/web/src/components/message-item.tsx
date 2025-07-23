"use client";

import { useMutation } from "@tanstack/react-query";
import {
  type Dispatch,
  memo,
  type SetStateAction,
  useCallback,
  useState,
} from "react";
import type { z } from "zod";
import { useProject } from "@/lib/context/project";
import { useTRPC } from "@/lib/trpc/react";

import type { RouterOutputs } from "@weldr/api";
import type {
  ChatMessage,
  IntegrationKey,
  IntegrationStatus,
  TPendingMessage,
} from "@weldr/shared/types";
import type { toolMessageSchema } from "@weldr/shared/validators/chats";
import { LogoIcon } from "@weldr/ui/icons";
import { cn } from "@weldr/ui/lib/utils";
import { ChatIntegrationDialog } from "./chat-integration-dialog";
import { CustomMarkdown } from "./custom-markdown";

const PureMessageItem = ({
  message,
  environmentVariables,
  setMessages,
  setPendingMessage,
}: {
  message: ChatMessage;
  environmentVariables: RouterOutputs["environmentVariables"]["list"];
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  setPendingMessage: Dispatch<SetStateAction<TPendingMessage>>;
}) => {
  return (
    <div
      className={cn(
        "flex flex-col text-sm",
        message.role === "user" && "items-end",
      )}
      key={message.id}
    >
      {message.role === "assistant" && (
        <div className="flex items-center gap-1 pb-2">
          <LogoIcon className="size-5" />
          <span className="text-muted-foreground text-xs">Weldr</span>
        </div>
      )}

      <div
        className={cn({
          "rounded-md bg-primary p-2 text-primary-foreground":
            message.role === "user",
        })}
      >
        {Array.isArray(message.content) && (
          <CustomMarkdown
            className={cn({
              "text-primary-foreground": message.role === "user",
            })}
            content={message.content}
          />
        )}

        {message.role === "tool" &&
          message.content.some(
            (content) =>
              content.toolName === "add_integrations" ||
              content.toolName === "init_project",
          ) && (
            <SetupIntegration
              message={message}
              setMessages={setMessages}
              setPendingMessage={setPendingMessage}
              environmentVariables={environmentVariables}
            />
          )}
      </div>
    </div>
  );
};

export const MessageItem = memo(PureMessageItem, (prevProps, nextProps) => {
  if (prevProps.message.content !== nextProps.message.content) return false;
  return true;
});

type IntegrationToolResultPart = {
  type: "tool-result";
  toolCallId: string;
  toolName: string;
  output: {
    status: "awaiting_config" | "completed" | "failed";
    integrations: {
      id: string;
      key: IntegrationKey;
      status: IntegrationStatus;
    }[];
  };
  isError: boolean;
};

type IntegrationMessage = {
  id: string;
  visibility: "public" | "internal";
  createdAt: Date;
  chatId: string;
  role: "tool";
  content: IntegrationToolResultPart[];
};

const PureSetupIntegration = ({
  message,
  environmentVariables,
  setMessages,
  setPendingMessage,
}: {
  message: z.infer<typeof toolMessageSchema>;
  environmentVariables: RouterOutputs["environmentVariables"]["list"];
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  setPendingMessage: Dispatch<SetStateAction<TPendingMessage>>;
}) => {
  const [integrationMessage, setIntegrationMessage] =
    useState<IntegrationMessage>({
      id: message.id,
      visibility: message.visibility,
      createdAt: message.createdAt,
      chatId: message.chatId,
      role: "tool",
      content: message.content as IntegrationToolResultPart[],
    } as IntegrationMessage);

  const integrations = integrationMessage.content[0]?.output.integrations?.sort(
    (a, b) => {
      if (a.status === "awaiting_config") return -1;
      if (b.status === "awaiting_config") return 1;
      return 0;
    },
  );

  const { project } = useProject();
  const trpc = useTRPC();

  const updateToolMessageMutation = useMutation(
    trpc.chats.updateToolMessage.mutationOptions(),
  );

  const installIntegrationsMutation = useMutation(
    trpc.integrations.install.mutationOptions(),
  );

  const onIntegrationMessageChange = useCallback(
    ({
      integrationId,
      integrationStatus,
    }: {
      integrationId: string;
      integrationStatus: IntegrationStatus;
    }) => {
      // biome-ignore lint/style/noNonNullAssertion: reason
      const messageContent = integrationMessage.content[0]!;

      // Create a new integration message with updated integrations
      const updatedIntegrations = messageContent.output.integrations?.map(
        (integration) => {
          if (integration.id === integrationId) {
            return { ...integration, status: integrationStatus };
          }
          return integration;
        },
      );

      // Check if all integrations are configured (no longer awaiting config)
      const allIntegrationsConfigured = updatedIntegrations?.every(
        (integration) => integration.status !== "awaiting_config",
      );

      const updatedIntegrationMessage = {
        ...integrationMessage,
        content: [
          {
            ...messageContent,
            output: {
              ...messageContent.output,
              integrations: updatedIntegrations,
              status: allIntegrationsConfigured
                ? "completed"
                : messageContent.output.status,
            },
          },
        ] as IntegrationToolResultPart[],
      } as IntegrationMessage;

      // Update the message in the database
      updateToolMessageMutation.mutate({
        where: {
          messageId: integrationMessage.id,
        },
        data: {
          content: updatedIntegrationMessage.content,
        },
      });

      console.log({
        updatedIntegrationMessage,
      });

      // Update the integration message state
      setIntegrationMessage(updatedIntegrationMessage);

      // Update the message in the messages array
      setMessages((prevMessages) => {
        return prevMessages.map((m) => {
          if (m.id === integrationMessage.id) {
            return updatedIntegrationMessage;
          }
          return m;
        }) as ChatMessage[];
      });

      if (allIntegrationsConfigured) {
        installIntegrationsMutation.mutate({
          projectId: project.id,
          triggerWorkflow: true,
        });
        setPendingMessage("thinking");
      }
    },
    [
      project,
      integrationMessage,
      setMessages,
      setPendingMessage,
      updateToolMessageMutation,
      installIntegrationsMutation,
    ],
  );

  return (
    <div className="flex flex-col gap-1 rounded-md border p-1.5">
      <span className="font-medium text-muted-foreground text-xs">
        Setup integrations
      </span>
      {integrations?.map((integration) => {
        return (
          <ChatIntegrationDialog
            key={integration.id}
            environmentVariables={environmentVariables}
            integration={integration}
            onIntegrationMessageChange={onIntegrationMessageChange}
          />
        );
      })}
    </div>
  );
};

export const SetupIntegration = memo(
  PureSetupIntegration,
  (prevProps, nextProps) => {
    if (prevProps.message !== nextProps.message) return false;
    return true;
  },
);
