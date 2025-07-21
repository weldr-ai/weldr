"use client";

import { memo } from "react";
import type { z } from "zod";

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
  setMessages,
  setPendingMessage,
  integrationTemplates,
  environmentVariables,
}: {
  message: ChatMessage;
  setMessages: (messages: ChatMessage[]) => void;
  pendingMessage: TPendingMessage;
  setPendingMessage: (pendingMessage: TPendingMessage) => void;
  integrationTemplates: RouterOutputs["integrationTemplates"]["list"];
  environmentVariables: RouterOutputs["environmentVariables"]["list"];
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
              setMessages={setMessages}
              setPendingMessage={setPendingMessage}
              message={message}
              integrationTemplates={integrationTemplates}
              environmentVariables={environmentVariables}
            />
          )}
      </div>
    </div>
  );
};

export const MessageItem = memo(PureMessageItem, (prevProps, nextProps) => {
  if (prevProps.pendingMessage !== nextProps.pendingMessage) return false;
  if (prevProps.message.content !== nextProps.message.content) return false;
  return true;
});

const PureSetupIntegration = ({
  message,
  integrationTemplates,
  environmentVariables,
  setMessages,
  setPendingMessage,
}: {
  message: z.infer<typeof toolMessageSchema>;
  integrationTemplates: RouterOutputs["integrationTemplates"]["list"];
  environmentVariables: RouterOutputs["environmentVariables"]["list"];
  setMessages: (messages: ChatMessage[]) => void;
  setPendingMessage: (pendingMessage: "thinking" | "waiting" | null) => void;
}) => {
  // Get the first content item which contains the tool result
  const toolResult = Array.isArray(message.content)
    ? message.content[0]
    : message.content;

  const toolInfo = toolResult as unknown as {
    output: {
      status: "requires_configuration" | "completed" | "failed";
      integrations: {
        id: string;
        key: IntegrationKey;
        status: IntegrationStatus;
      }[];
    };
    toolName: string;
  };

  const integrationsMap =
    toolInfo.output.integrations?.reduce(
      (acc, integration) => {
        if (integration.status === "requires_configuration") {
          acc[integration.id] = {
            status: integration.status,
            template: integrationTemplates.find(
              (template) => template.key === integration.key,
            ) as RouterOutputs["integrationTemplates"]["list"][number],
          };
        }
        return acc;
      },
      {} as Record<
        string,
        {
          status: IntegrationStatus;
          template: RouterOutputs["integrationTemplates"]["list"][number];
        }
      >,
    ) || {};

  return (
    <div className="flex flex-col gap-1 rounded-md border p-1.5">
      <span className="font-medium text-muted-foreground text-xs">
        Setup integrations
      </span>
      {Object.entries(integrationsMap).map(([id, integration]) => {
        return (
          <div key={id}>
            <ChatIntegrationDialog
              integrationTemplate={integration.template}
              environmentVariables={environmentVariables}
              status={integration.status}
              // onSuccess={() => {
              //   updateIntegrationStatus(integration, "completed");
              // }}
              // onCancel={() => {
              //   updateIntegrationStatus(integration, "cancelled");
              // }}
            />
          </div>
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
