"use client";

import fastDeepEqual from "fast-deep-equal";
import { memo } from "react";

import type { ChatMessage } from "@weldr/shared/types";
import { LogoIcon } from "@weldr/ui/icons";
import { cn } from "@weldr/ui/lib/utils";

import { CustomMarkdown } from "./custom-markdown";
import { IntegrationsSetupStatus } from "./setup-integrations/integrations-setup-status";
import type { IntegrationToolMessage } from "./setup-integrations/types";

const PureMessageItem = ({ message }: { message: ChatMessage }) => {
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
            (content) => content.toolName === "add_integrations",
          ) && (
            <IntegrationsSetupStatus
              message={message as IntegrationToolMessage}
            />
          )}
      </div>
    </div>
  );
};

export const MessageItem = memo(PureMessageItem, (prevProps, nextProps) => {
  if (!fastDeepEqual(prevProps.message, nextProps.message)) {
    return false;
  }
  return true;
});
