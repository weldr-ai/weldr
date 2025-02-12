import { authClient } from "@weldr/auth/client";
import type { ChatMessage } from "@weldr/shared/types";
import { Avatar, AvatarFallback, AvatarImage } from "@weldr/ui/avatar";
import { useEffect, useState } from "react";
import { RawContentViewer } from "./raw-content-viewer";

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

export default function MessageList({
  messages,
  isRunning,
  isThinking,
  isBuilding,
}: {
  messages: ChatMessage[];
  isRunning?: boolean;
  isThinking: boolean;
  isBuilding?: boolean;
}) {
  return (
    <div className="flex w-full flex-col gap-4">
      {messages.map((message, index) => {
        if (!message.rawContent) return null;
        return <MessageItem key={`${message.id ?? index}`} message={message} />;
      })}

      {isThinking && (
        <div key="thinking" className="flex items-start">
          <Avatar className="size-7 rounded-full">
            <AvatarImage src="/api/avatars/weldr" alt="Weldr" />
          </Avatar>
          <span className="ml-3 text-muted-foreground text-sm">
            Thinking
            <TypingDots />
          </span>
        </div>
      )}

      {isBuilding && (
        <div key="generating" className="flex items-start">
          <Avatar className="size-7 rounded-full">
            <AvatarImage src="/api/avatars/weldr" alt="Weldr" />
          </Avatar>
          <span className="ml-3 text-muted-foreground text-sm">
            Building
            <TypingDots />
          </span>
        </div>
      )}

      {isRunning && (
        <div key="running" className="flex items-start">
          <Avatar className="size-7 rounded-full">
            <AvatarImage src="/api/avatars/weldr" alt="Weldr" />
          </Avatar>
          <span className="ml-3 text-muted-foreground text-sm">
            Running your function
            <TypingDots />
          </span>
        </div>
      )}
    </div>
  );
}

function MessageItem({
  message,
}: {
  message: ChatMessage;
}) {
  const { data: session } = authClient.useSession();

  return (
    <div className="flex w-full items-start" key={message.id}>
      <Avatar className="size-7 rounded-full">
        {message.role === "user" ? (
          <>
            <AvatarImage src={session?.user.image ?? undefined} alt="User" />
            <AvatarFallback>
              <Avatar className="size-7 rounded-full">
                <AvatarImage
                  src={`/api/avatars/${session?.user.email}`}
                  alt="User"
                />
              </Avatar>
            </AvatarFallback>
          </>
        ) : (
          <Avatar className="size-7 rounded-full">
            <AvatarImage src="/api/avatars/weldr" alt="Weldr" />
          </Avatar>
        )}
      </Avatar>
      <div className="ml-3 space-y-1">
        {Array.isArray(message.rawContent) && (
          <RawContentViewer rawContent={message.rawContent} />
        )}
        {message.role === "assistant" && message.version && (
          <div className="group flex h-7 items-center gap-2">
            <div className="inline-flex h-7 cursor-text select-text items-center justify-center rounded-md bg-success/10 px-1.5 py-0.5 font-semibold text-success text-xs">
              {`#${message.version.versionNumber} `}
              {message.version.versionName}
            </div>
            {/* {message.version.id !== currentVersionId && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="hidden size-7 group-hover:flex"
                  >
                    <HistoryIcon className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  className="border bg-muted text-xs"
                >
                  Revert
                </TooltipContent>
              </Tooltip>
            )} */}
          </div>
        )}
      </div>
    </div>
  );
}
