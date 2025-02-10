import { useAuth } from "@weldr/auth/provider";
import type {
  ChatMessage,
  RawContent,
  TestExecutionMessageRawContent,
} from "@weldr/shared/types";
import { testExecutionMessageRawContentSchema } from "@weldr/shared/validators/chats";
import { Avatar, AvatarFallback, AvatarImage } from "@weldr/ui/avatar";
import { ScrollArea } from "@weldr/ui/scroll-area";
import { useEffect, useState } from "react";
import SuperJSON from "superjson";
import { JsonViewer } from "./json-viewer";
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
  const { user } = useAuth();

  const isTestExecution = testExecutionMessageRawContentSchema.safeParse(
    message.rawContent,
  ).success;

  return (
    <div className="flex w-full items-start" key={message.id}>
      <Avatar className="size-7 rounded-full">
        {message.role === "user" ? (
          <>
            <AvatarImage src={user?.image ?? undefined} alt="User" />
            <AvatarFallback>
              <Avatar className="size-7 rounded-full">
                <AvatarImage src={`/api/avatars/${user?.email}`} alt="User" />
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
        {isTestExecution ? (
          <TestExecutionItem
            testExecution={message.rawContent as TestExecutionMessageRawContent}
          />
        ) : (
          <RawContentViewer
            rawContent={(message.rawContent ?? []) as RawContent}
          />
        )}
        {message.version && (
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

function TestExecutionItem({
  testExecution,
}: { testExecution: TestExecutionMessageRawContent }) {
  const stdout = testExecution.stdout
    ? (() => {
        // Find the JSON part of the output using regex
        const jsonMatch = testExecution.stdout?.match(/\{.*\}/s);
        if (!jsonMatch) return undefined;

        try {
          return SuperJSON.parse(jsonMatch[0]);
        } catch (e) {
          console.error("Failed to parse JSON:", e);
          return undefined;
        }
      })()
    : undefined;

  return (
    <div className="flex w-full items-start">
      <Avatar className="size-6 rounded-md">
        <AvatarImage src="/logo-solid.svg" alt="Integrator" />
      </Avatar>
      <div className="ml-3 flex h-48 w-full rounded-md bg-background">
        <ScrollArea className="max-h-48 w-full px-1 py-2">
          <pre>
            {testExecution.stderr && (
              <p className="text-red-500 text-xs">{testExecution.stderr}</p>
            )}
            {testExecution.stdout && <JsonViewer data={stdout ?? {}} />}
          </pre>
        </ScrollArea>
      </div>
    </div>
  );
}
