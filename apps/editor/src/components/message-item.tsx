"use client";

import { memo } from "react";

import { api } from "@/lib/trpc/client";
import type { TPendingMessage } from "@/types";
import type { RouterOutputs } from "@weldr/api";
import type { ChatMessage, ToolMessage } from "@weldr/shared/types";
import { toast } from "@weldr/ui/hooks/use-toast";
import {
  JsonIcon,
  LogoIcon,
  MarkdownIcon,
  MdxIcon,
  SvgIcon,
  TsxIcon,
  TypescriptIcon,
  XmlIcon,
  YamlIcon,
} from "@weldr/ui/icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@weldr/ui/tooltip";
import { cn } from "@weldr/ui/utils";
import { CheckIcon, CodeIcon, GitCommitIcon, LoaderIcon } from "lucide-react";
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
        "flex w-full flex-col text-sm",
        message.role === "user" && "items-end",
      )}
      key={message.id}
    >
      {message.role === "assistant" && (
        <div className="flex items-center gap-1">
          <LogoIcon className="size-5" />
          <span className="text-muted-foreground text-xs">Weldr</span>
        </div>
      )}

      <div
        className={cn(message.role === "user" && "rounded-md bg-primary p-2")}
      >
        {Array.isArray(message.rawContent) && (
          <CustomMarkdown content={message.rawContent} />
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
          <div className="flex flex-col rounded-md border bg-background text-xs">
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
                <TooltipContent className="space-x-1 border bg-muted px-1 py-0.5 text-xs">
                  <span className="text-muted-foreground">
                    {`#${message.rawContent.versionNumber}`}
                  </span>
                  <span>{message.rawContent.versionMessage}</span>
                </TooltipContent>
              </Tooltip>

              <span className="flex items-center gap-1">
                {message.rawContent.changedFiles.length} files changed
              </span>
            </div>

            <div className="flex flex-col gap-1 p-2">
              {message.rawContent.changedFiles.map((file) => (
                <div
                  key={file.path}
                  className="grid grid-cols-[auto_auto_1fr] items-center gap-1"
                >
                  <CheckIcon
                    className={cn("size-4 text-success", {
                      hidden: file.status !== "success",
                    })}
                  />
                  <LoaderIcon
                    className={cn("size-4 animate-spin text-primary", {
                      hidden: file.status !== "pending",
                    })}
                  />
                  {file.path.endsWith(".ts") ? (
                    <TypescriptIcon className="size-4" />
                  ) : file.path.endsWith(".tsx") ? (
                    <TsxIcon className="size-4" />
                  ) : file.path.endsWith(".mdx") ? (
                    <MdxIcon className="size-4" />
                  ) : file.path.endsWith(".md") ? (
                    <MarkdownIcon className="size-4" />
                  ) : file.path.endsWith(".yaml") ? (
                    <YamlIcon className="size-4" />
                  ) : file.path.endsWith(".svg") ? (
                    <SvgIcon className="size-4" />
                  ) : file.path.endsWith(".xml") ? (
                    <XmlIcon className="size-4" />
                  ) : file.path.endsWith(".json") ? (
                    <JsonIcon className="size-4" />
                  ) : (
                    <CodeIcon className="size-4" />
                  )}
                  <span className="truncate">{file.path}</span>
                </div>
              ))}
            </div>
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
