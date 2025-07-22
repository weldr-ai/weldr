import equal from "fast-deep-equal";
import { type Dispatch, memo, type SetStateAction } from "react";

import type { RouterOutputs } from "@weldr/api";
import { nanoid } from "@weldr/shared/nanoid";
import type { ChatMessage, TPendingMessage } from "@weldr/shared/types";
import { MessageItem } from "./message-item";

interface MessagesProps {
  messages: ChatMessage[];
  environmentVariables: RouterOutputs["environmentVariables"]["list"];
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  setPendingMessage: Dispatch<SetStateAction<TPendingMessage>>;
}

function PureMessages({
  messages,
  setMessages,
  setPendingMessage,
  environmentVariables,
}: MessagesProps) {
  return (
    <>
      {messages.map((message) => (
        <MessageItem
          key={message.id ?? nanoid()}
          message={message}
          environmentVariables={environmentVariables}
          setMessages={setMessages}
          setPendingMessage={setPendingMessage}
        />
      ))}
    </>
  );
}

export const Messages = memo(PureMessages, (prevProps, nextProps) => {
  if (prevProps.messages.length !== nextProps.messages.length) return false;
  if (!equal(prevProps.messages, nextProps.messages)) return false;
  return true;
});
