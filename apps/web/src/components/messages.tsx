import equal from "fast-deep-equal";
import { memo } from "react";

import { nanoid } from "@weldr/shared/nanoid";
import type { ChatMessage } from "@weldr/shared/types";
import { MessageItem } from "./message-item";

interface MessagesProps {
  messages: ChatMessage[];
}

function PureMessages({ messages }: MessagesProps) {
  return (
    <>
      {messages.map((message) => (
        <MessageItem key={message.id ?? nanoid()} message={message} />
      ))}
    </>
  );
}

export const Messages = memo(PureMessages, (prevProps, nextProps) => {
  if (prevProps.messages.length !== nextProps.messages.length) return false;
  if (!equal(prevProps.messages, nextProps.messages)) return false;
  return true;
});
