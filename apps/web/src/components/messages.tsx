import equal from "fast-deep-equal";
import { memo } from "react";

import type { RouterOutputs } from "@weldr/api";
import { nanoid } from "@weldr/shared/nanoid";
import type { ChatMessage, TPendingMessage } from "@weldr/shared/types";
import { MessageItem } from "./message-item";

interface MessagesProps {
  pendingMessage: TPendingMessage;
  setPendingMessage: (pendingMessage: TPendingMessage) => void;
  messages: ChatMessage[];
  setMessages: (messages: ChatMessage[]) => void;
  integrationTemplates: RouterOutputs["integrationTemplates"]["list"];
  environmentVariables: RouterOutputs["environmentVariables"]["list"];
}

function PureMessages({
  messages,
  setMessages,
  pendingMessage,
  setPendingMessage,
  integrationTemplates,
  environmentVariables,
}: MessagesProps) {
  return (
    <>
      {messages
        .filter(
          (message) =>
            !(
              message.role === "tool" &&
              message.content.some(
                (content) =>
                  content.type === "tool-result" &&
                  content.toolName !== "add_integrations",
              )
            ),
        )
        .map((message) => (
          <MessageItem
            key={message.id ?? nanoid()}
            message={message}
            setMessages={setMessages}
            pendingMessage={pendingMessage}
            setPendingMessage={setPendingMessage}
            integrationTemplates={integrationTemplates}
            environmentVariables={environmentVariables}
          />
        ))}
    </>
  );
}

export const Messages = memo(PureMessages, (prevProps, nextProps) => {
  if (prevProps.pendingMessage !== nextProps.pendingMessage) return false;
  if (prevProps.messages.length !== nextProps.messages.length) return false;
  if (!equal(prevProps.messages, nextProps.messages)) return false;
  return true;
});
