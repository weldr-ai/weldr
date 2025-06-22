"use client";

import { memo } from "react";

import { useTRPC } from "@/lib/trpc/react";
import { useMutation } from "@tanstack/react-query";
import type { RouterOutputs } from "@weldr/api";
import type { ChatMessage, TPendingMessage } from "@weldr/shared/types";
import type { toolMessageSchema } from "@weldr/shared/validators/chats";
import { toast } from "@weldr/ui/hooks/use-toast";
import { LogoIcon } from "@weldr/ui/icons";
import { cn } from "@weldr/ui/lib/utils";
import type { z } from "zod";
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
          message.content.some((content) => {
            if (content.type === "tool-result") {
              return content.toolName === "setupIntegration";
            }
            return false;
          }) && (
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
  setMessages,
  setPendingMessage,
  environmentVariables,
}: {
  message: z.infer<typeof toolMessageSchema>;
  integrationTemplates: RouterOutputs["integrationTemplates"]["list"];
  environmentVariables: RouterOutputs["environmentVariables"]["list"];
  setMessages: (messages: ChatMessage[]) => void;
  setPendingMessage: (pendingMessage: "thinking" | "waiting" | null) => void;
}) => {
  const toolInfo = message.content as unknown as {
    toolArgs: { integrations: "postgresql"[] };
    toolResult: { status: "pending" | "success" | "error" | "cancelled" };
  };

  const trpc = useTRPC();

  const updateMessageMutation = useMutation(
    trpc.chats.updateToolMessage.mutationOptions({
      onSuccess: (data) => {
        // @ts-expect-error
        setMessages((messages: ChatMessage[]) => {
          const message = messages.find((m) => m.id === data.id);
          if (message) {
            message.content = data.content as z.infer<
              typeof toolMessageSchema
            >["content"];
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

  for (const integration of toolInfo.toolArgs.integrations) {
    switch (integration) {
      case "postgresql": {
        const postgresIntegrationTemplate = integrationTemplates?.find(
          (integrationTemplate) => integrationTemplate.key === "postgresql",
        );

        if (!postgresIntegrationTemplate) {
          return null;
        }

        return (
          <ChatIntegrationDialog
            integrationTemplate={postgresIntegrationTemplate}
            environmentVariables={environmentVariables}
            status={toolInfo.toolResult.status}
            onSuccess={() => {
              updateMessageMutation.mutate({
                where: { messageId: message.id as string },
                data: {
                  content: [
                    {
                      type: "tool-result",
                      toolName: "setupIntegration",
                      toolCallId: message.content.find(
                        (c) => c.toolName === "setupIntegration",
                      )?.toolCallId as string,
                      result: { status: "success" },
                    },
                  ],
                },
              });
            }}
            onCancel={() => {
              updateMessageMutation.mutate({
                where: { messageId: message.id as string },
                data: {
                  content: [
                    {
                      type: "tool-result",
                      toolName: "setupIntegration",
                      toolCallId: message.content.find(
                        (c) => c.toolName === "setupIntegration",
                      )?.toolCallId as string,
                      result: { status: "cancelled" },
                    },
                  ],
                },
              });
            }}
          />
        );
      }
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
