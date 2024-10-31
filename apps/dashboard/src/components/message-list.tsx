import { createId } from "@paralleldrive/cuid2";
import type { ConversationMessage } from "@specly/shared/types";
import { Avatar, AvatarFallback, AvatarImage } from "@specly/ui/avatar";
import { cn } from "@specly/ui/utils";
import { Loader2 } from "lucide-react";
import type { RefObject } from "react";
import { ReferenceBadge } from "./editor/reference-badge";

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
          <p className="text-sm ml-3 select-text cursor-text">
            {messages.rawContent?.map((item, idx) => (
              <span
                key={`${idx}-${item.type}`}
                className={cn({
                  "text-success":
                    item.type === "text" &&
                    (item.value ?? "").toLowerCase().includes("successfully"),
                })}
              >
                {item.type === "text" ? (
                  item.value
                ) : (
                  <ReferenceBadge reference={item} />
                )}
              </span>
            ))}
          </p>
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
