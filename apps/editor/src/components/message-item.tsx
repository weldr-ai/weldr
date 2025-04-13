"use client";

import { memo } from "react";

import { api } from "@/lib/trpc/client";
import type { TPendingMessage } from "@/types";
import type { RouterOutputs } from "@weldr/api";
import type { ChatMessage, ToolMessage } from "@weldr/shared/types";
import { toast } from "@weldr/ui/hooks/use-toast";
import { LogoIcon } from "@weldr/ui/icons/logo-icon";
import { cn } from "@weldr/ui/utils";
import { ChatIntegrationDialog } from "./chat-integration-dialog";
import { RawContentViewer } from "./raw-content-viewer";

const PureMessageItem = ({
  message,
  setMessages,
  setPendingMessage,
  integrationTemplates,
}: {
  message: ChatMessage;
  setMessages: (messages: ChatMessage[]) => void;
  pendingMessage: TPendingMessage;
  setPendingMessage: (pendingMessage: TPendingMessage) => void;
  integrationTemplates: RouterOutputs["integrationTemplates"]["list"];
}) => {
  return (
    <div
      className={cn(
        "flex w-full flex-col text-sm",
        message.role === "user" && "items-end",
      )}
      key={message.id}
    >
      {message.role === "assistant" && (
        <div className="flex items-center gap-1">
          <LogoIcon className="size-6 p-0" />
          <span className="text-muted-foreground text-xs">Weldr</span>
        </div>
      )}

      <div
        className={cn(message.role === "user" && "rounded-md bg-primary p-2")}
      >
        {Array.isArray(message.rawContent) && (
          <RawContentViewer rawContent={message.rawContent} />
        )}

        {message.role === "assistant" && message.version && (
          <div className="inline-flex h-7 cursor-text select-text items-center justify-center rounded-md bg-success/10 px-1.5 py-0.5 font-semibold text-success text-xs">
            {`#${message.version.versionNumber} `}
            {message.version.versionName}
          </div>
        )}

        {message.role === "tool" &&
          message.rawContent.toolName === "setupIntegrationTool" && (
            <SetupIntegration
              setMessages={setMessages}
              setPendingMessage={setPendingMessage}
              message={message}
              integrationTemplates={integrationTemplates}
            />
          )}

        {message.role === "version" && (
          <div className="flex max-w-64 items-center gap-1 rounded-md border border-success bg-success/10 p-2 text-success text-xs">
            <span>{`#${message.rawContent.versionNumber}`}</span>
            <span className="truncate">
              {message.rawContent.versionMessage}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export const MessageItem = memo(PureMessageItem, (prevProps, nextProps) => {
  if (prevProps.pendingMessage !== nextProps.pendingMessage) return false;
  if (prevProps.message.rawContent !== nextProps.message.rawContent)
    return false;
  return true;
});

const PureSetupIntegration = ({
  message,
  integrationTemplates,
  setMessages,
  setPendingMessage,
}: {
  message: ToolMessage;
  integrationTemplates: RouterOutputs["integrationTemplates"]["list"];
  setMessages: (messages: ChatMessage[]) => void;
  setPendingMessage: (pendingMessage: "thinking" | "waiting" | null) => void;
}) => {
  const toolInfo = message.rawContent as unknown as {
    toolArgs: { integration: "postgres" };
    toolResult: { status: "pending" | "success" | "error" | "cancelled" };
  };

  const updateMessageMutation = api.chats.updateMessage.useMutation({
    onSuccess: (data) => {
      // @ts-expect-error
      setMessages((messages: ChatMessage[]) => {
        const message = messages.find((m) => m.id === data.id);
        if (message) {
          message.rawContent = data.rawContent;
        }
        return messages;
      });
      setPendingMessage(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update message",
      });
      setPendingMessage(null);
    },
  });

  switch (toolInfo.toolArgs.integration) {
    case "postgres": {
      const postgresIntegrationTemplate = integrationTemplates?.find(
        (integrationTemplate) => integrationTemplate.type === "postgres",
      );

      if (!postgresIntegrationTemplate) {
        return null;
      }

      return (
        <ChatIntegrationDialog
          integrationTemplate={postgresIntegrationTemplate}
          status={toolInfo.toolResult.status}
          onSuccess={() => {
            updateMessageMutation.mutate({
              where: { messageId: message.id as string },
              data: {
                type: "tool",
                toolResult: { status: "success" },
              },
            });
          }}
          onCancel={() => {
            updateMessageMutation.mutate({
              where: { messageId: message.id as string },
              data: {
                type: "tool",
                toolResult: { status: "cancelled" },
              },
            });
          }}
        />
      );
    }
  }
};

export const SetupIntegration = memo(
  PureSetupIntegration,
  (prevProps, nextProps) => {
    if (prevProps.message !== nextProps.message) return false;
    return true;
  },
);
