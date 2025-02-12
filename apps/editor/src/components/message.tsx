"use client";

import { memo, useEffect, useState } from "react";

import type { RouterOutputs } from "@weldr/api";
import { authClient } from "@weldr/auth/client";
import type { ChatMessage } from "@weldr/shared/types";
import { Avatar, AvatarFallback, AvatarImage } from "@weldr/ui/avatar";
import { LogoIcon } from "@weldr/ui/icons/logo-icon";
import { cn } from "@weldr/ui/utils";
import Image from "next/image";
import { AddResourceDialog } from "./add-resource-dialog";
import { RawContentViewer } from "./raw-content-viewer";

const PurePreviewMessage = ({
  message,
  integrations,
}: {
  message: ChatMessage;
  isThinking: boolean;
  integrations: RouterOutputs["integrations"]["list"];
}) => {
  const { data: session } = authClient.useSession();

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-2",
        message.role === "user" && "items-end",
      )}
      key={message.id}
    >
      {message.role === "user" && (
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground text-xs">
            {message.userId === session?.user.id ? "You" : message.user?.name}
          </span>
          <Avatar className="size-7 rounded-full">
            <AvatarImage src={message.user?.image ?? undefined} alt="User" />
            <AvatarFallback>
              <Image
                src={`/api/avatars/${message.user?.email}`}
                alt="User"
                width={28}
                height={28}
              />
            </AvatarFallback>
          </Avatar>
        </div>
      )}

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
                resource={
                  (
                    message.rawContent.toolArgs as {
                      resource: "postgres";
                    }
                  ).resource
                }
                integrations={integrations}
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
    if (prevProps.isThinking !== nextProps.isThinking) return false;
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

export const ThinkingMessage = () => {
  return (
    <div key="thinking" className="flex w-full flex-col gap-2">
      <div className="flex items-center gap-1">
        <LogoIcon className="size-6 p-0" />
        <span className="text-muted-foreground text-xs">Weldr</span>
      </div>
      <span className="text-muted-foreground text-sm">
        Thinking
        <TypingDots />
      </span>
    </div>
  );
};

export function SetupResource({
  resource,
  integrations,
}: {
  resource: "postgres";
  integrations: RouterOutputs["integrations"]["list"];
}) {
  console.log(integrations);

  switch (resource) {
    case "postgres": {
      const postgresIntegration = integrations?.find(
        (integration) => integration.type === "postgres",
      );

      if (!postgresIntegration) {
        return null;
      }

      return (
        <AddResourceDialog
          integration={postgresIntegration}
          env={[]}
          className="border bg-background hover:bg-accent"
        />
      );
    }
  }
}
