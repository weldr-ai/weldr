import { createId } from "@paralleldrive/cuid2";
import type { ConversationMessage } from "@specly/shared/types";
import { Avatar, AvatarFallback, AvatarImage } from "@specly/ui/avatar";
import { Loader2 } from "lucide-react";
import type { RefObject } from "react";
import { RawDescriptionViewer } from "./raw-description-viewer";

export default function MessageList({
  messages,
  isGenerating,
  chatHistoryEndRef,
}: {
  messages: ConversationMessage[];
  isGenerating: boolean;
  chatHistoryEndRef: RefObject<HTMLDivElement>;
}) {
  return (
    <div className="flex flex-col gap-4">
      {messages.map((messages) => (
        <div className="flex items-start" key={messages.id ?? createId()}>
          <Avatar className="size-6 rounded-md">
            {messages.role === "user" ? (
              <>
                <AvatarImage src={undefined} alt="User" />
                <AvatarFallback>
                  <div className="size-full bg-gradient-to-br from-rose-500 via-amber-600 to-blue-500" />
                </AvatarFallback>
              </>
            ) : (
              <AvatarImage src="/logo.svg" alt="Specly" />
            )}
          </Avatar>
          <div className="ml-3">
            <RawDescriptionViewer rawDescription={messages.rawContent ?? []} />
          </div>
        </div>
      ))}
      {isGenerating && (
        <div className="flex items-center justify-center">
          <Loader2 className="size-4 animate-spin" />
        </div>
      )}
      <div ref={chatHistoryEndRef} />
    </div>
  );
}
