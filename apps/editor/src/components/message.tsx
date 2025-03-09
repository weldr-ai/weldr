"use client";

import { memo, useEffect, useState } from "react";

import { api } from "@/lib/trpc/client";
import type { TPendingMessage } from "@/types";
import type { ChatMessage, ToolMessage } from "@weldr/shared/types";
import { toast } from "@weldr/ui/hooks/use-toast";
import { LogoIcon } from "@weldr/ui/icons/logo-icon";
import { cn } from "@weldr/ui/utils";
import { ChatResourceDialog } from "./chat-resource-dialog";
import { RawContentViewer } from "./raw-content-viewer";

const PurePreviewMessage = ({
  message,
  setMessages,
  setPendingMessage,
  // integrations,
}: {
  message: ChatMessage;
  setMessages: (messages: ChatMessage[]) => void;
  pendingMessage: TPendingMessage;
  setPendingMessage: (pendingMessage: TPendingMessage) => void;
  // integrations: RouterOutputs["integrations"]["list"];
}) => {
  return (
    <div
      className={cn(
        "flex w-full flex-col gap-2",
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
        className={cn(
          "space-y-1",
          message.role === "user" && "rounded-md bg-primary p-2",
        )}
      >
        {Array.isArray(message.rawContent) && (
          <RawContentViewer rawContent={message.rawContent} />
        )}
        {message.role === "assistant" && message.version && (
          <div className="group flex h-7 items-center gap-2">
            <div className="inline-flex h-7 cursor-text select-text items-center justify-center rounded-md bg-success/10 px-1.5 py-0.5 font-semibold text-success text-xs">
              {`#${message.version.versionNumber} `}
              {message.version.versionName}
            </div>
          </div>
        )}
        {message.role === "tool" && (
          <div className="flex items-center gap-1">
            {message.rawContent.toolName === "setupResource" && (
              <SetupResource
                setMessages={setMessages}
                setPendingMessage={setPendingMessage}
                message={message}
                // integrations={integrations}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export const PreviewMessage = memo(
  PurePreviewMessage,
  (prevProps, nextProps) => {
    if (prevProps.pendingMessage !== nextProps.pendingMessage) return false;
    if (prevProps.message.rawContent !== nextProps.message.rawContent)
      return false;
    return true;
  },
);

const TypingDots = () => {
  const [dots, setDots] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prevDots) => {
        if (prevDots.length >= 3) return "";
        return `${prevDots}.`;
      });
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return <span>{dots}</span>;
};

export const PendingMessage = ({
  type,
}: {
  type: Exclude<TPendingMessage, null>;
}) => {
  return (
    <div key="thinking" className="flex w-full flex-col gap-2">
      <div className="flex items-center gap-1">
        <LogoIcon className="size-6 p-0" />
        <span className="text-muted-foreground text-xs">Weldr</span>
      </div>
      <span className="text-muted-foreground text-sm">
        {type.charAt(0).toUpperCase() + type.slice(1)}
        <TypingDots />
      </span>
    </div>
  );
};

export function SetupResource({
  message,
  // integrations,
  setMessages,
  setPendingMessage,
}: {
  message: ToolMessage;
  // integrations: RouterOutputs["integrations"]["list"];
  setMessages: (messages: ChatMessage[]) => void;
  setPendingMessage: (pendingMessage: "thinking" | "waiting" | null) => void;
}) {
  const toolInfo = message.rawContent as unknown as {
    toolArgs: { resource: "postgres" };
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

  switch (toolInfo.toolArgs.resource) {
    case "postgres": {
      // const postgresIntegration = integrations?.find(
      //   (integration) => integration.type === "postgres",
      // );

      // if (!postgresIntegration) {
      //   return null;
      // }

      return (
        <ChatResourceDialog
          // integration={postgresIntegration}
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
}
