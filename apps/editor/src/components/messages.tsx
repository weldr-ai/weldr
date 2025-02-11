import type { ChatMessage } from "@weldr/shared/types";
import equal from "fast-deep-equal";
import { memo } from "react";
import { useScrollToBottom } from "../hooks/use-scroll-to-bottom";
import { PreviewMessage, ThinkingMessage } from "./message";

interface MessagesProps {
  isThinking: boolean;
  messages: ChatMessage[];
}

function PureMessages({ isThinking, messages }: MessagesProps) {
  const [messagesContainerRef, messagesEndRef] =
    useScrollToBottom<HTMLDivElement>();

  return (
    <div
      ref={messagesContainerRef}
      className="scrollbar scrollbar-thumb-rounded-full scrollbar-thumb-muted-foreground scrollbar-track-transparent flex min-w-0 flex-1 flex-col gap-4 overflow-y-scroll p-2"
    >
      {messages.map((message) => (
        <PreviewMessage
          key={message.id}
          message={message}
          isThinking={isThinking}
        />
      ))}

      {isThinking &&
        messages.length > 0 &&
        messages[messages.length - 1]?.role === "user" && <ThinkingMessage />}

      <div ref={messagesEndRef} />
    </div>
  );
}

export const Messages = memo(PureMessages, (prevProps, nextProps) => {
  if (prevProps.isThinking !== nextProps.isThinking) return false;
  if (prevProps.isThinking && nextProps.isThinking) return false;
  if (prevProps.messages.length !== nextProps.messages.length) return false;
  if (!equal(prevProps.messages, nextProps.messages)) return false;

  return true;
});
