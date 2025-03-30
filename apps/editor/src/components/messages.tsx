import type { TPendingMessage } from "@/types";
import { createId } from "@paralleldrive/cuid2";
import type { ChatMessage } from "@weldr/shared/types";
import { cn } from "@weldr/ui/utils";
import equal from "fast-deep-equal";
import { memo } from "react";
import { useScrollToBottom } from "../hooks/use-scroll-to-bottom";
import { MessageItem } from "./message-item";

interface MessagesProps {
  pendingMessage: TPendingMessage;
  setPendingMessage: (pendingMessage: TPendingMessage) => void;
  messages: ChatMessage[];
  setMessages: (messages: ChatMessage[]) => void;
  // integrations: RouterOutputs["integrations"]["list"];
}

function PureMessages({
  messages,
  setMessages,
  pendingMessage,
  setPendingMessage,
  // integrations,
}: MessagesProps) {
  const [messagesContainerRef, messagesEndRef] =
    useScrollToBottom<HTMLDivElement>();

  return (
    <div
      ref={messagesContainerRef}
      className={cn(
        "scrollbar scrollbar-thumb-rounded-full scrollbar-thumb-muted-foreground scrollbar-track-transparent flex h-full max-h-[calc(100vh-188px)] min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-2",
        pendingMessage && "max-h-[calc(100vh-212px)]",
      )}
    >
      {messages
        .filter(
          (message) =>
            !(
              message.role === "tool" &&
              message.rawContent.toolName !== "setupResource"
            ),
        )
        .map((message) => (
          <MessageItem
            key={message.id ?? createId()}
            message={message}
            setMessages={setMessages}
            pendingMessage={pendingMessage}
            setPendingMessage={setPendingMessage}
            // integrations={integrations}
          />
        ))}
      <div ref={messagesEndRef} />
    </div>
  );
}

export const Messages = memo(PureMessages, (prevProps, nextProps) => {
  if (prevProps.pendingMessage !== nextProps.pendingMessage) return false;
  if (prevProps.messages.length !== nextProps.messages.length) return false;
  if (!equal(prevProps.messages, nextProps.messages)) return false;

  return true;
});
