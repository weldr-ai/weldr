"use client";

import { memo } from "react";

import { useTRPC } from "@/lib/trpc/react";
import type { TPendingMessage } from "@/types";
import { useMutation } from "@tanstack/react-query";
import type { RouterOutputs } from "@weldr/api";
import type { ChatMessage, ToolMessage } from "@weldr/shared/types";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@weldr/ui/components/tooltip";
import { toast } from "@weldr/ui/hooks/use-toast";
import { LogoIcon } from "@weldr/ui/icons";
import { cn } from "@weldr/ui/lib/utils";
import { GitCommitIcon } from "lucide-react";
import { ChatIntegrationDialog } from "./chat-integration-dialog";
import { CustomMarkdown } from "./custom-markdown";

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
        "flex flex-col text-sm",
        message.role === "user" && "items-end",
      )}
      key={message.id}
    >
      {(message.role === "assistant" || message.role === "version") && (
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
        {Array.isArray(message.rawContent) && (
          <CustomMarkdown
            className={cn({
              "text-primary-foreground": message.role === "user",
            })}
            content={message.rawContent}
          />
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
          <div className="grid grid-cols-[auto_auto_1fr_auto] items-center justify-between gap-1 rounded-t-md border-b bg-muted px-2 py-1 text-muted-foreground">
            <GitCommitIcon className="size-3.5 text-success" />

            <span className="text-muted-foreground">
              {`#${message.rawContent.versionNumber}`}
            </span>

            <Tooltip>
              <TooltipTrigger asChild>
                <span className="max-w-64 truncate text-foreground">
                  {message.rawContent.versionMessage}
                </span>
              </TooltipTrigger>
              <TooltipContent className="space-x-1 rounded-sm border bg-muted text-foreground text-xs">
                <span className="text-muted-foreground">
                  {`#${message.rawContent.versionNumber}`}
                </span>
                <span>{message.rawContent.versionMessage}</span>
              </TooltipContent>
            </Tooltip>
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

  const trpc = useTRPC();

  const updateMessageMutation = useMutation(
    trpc.chats.updateMessage.mutationOptions({
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
    }),
  );

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
