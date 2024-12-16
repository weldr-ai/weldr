import type { ConversationMessage, TestRun } from "@integramind/shared/types";
import { Avatar, AvatarFallback, AvatarImage } from "@integramind/ui/avatar";
import { ScrollArea } from "@integramind/ui/scroll-area";
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
  testRuns,
  isRunning,
  isThinking,
  isGenerating,
}: {
  messages: ConversationMessage[];
  testRuns?: TestRun[];
  isRunning?: boolean;
  isThinking: boolean;
  isGenerating?: boolean;
}) {
  const testRunList: (TestRun & { type: "test-run" })[] = (testRuns ?? []).map(
    (testRun) => ({
      ...testRun,
      type: "test-run",
    }),
  );

  const messageList: (ConversationMessage & { type: "message" })[] =
    messages.map((message) => ({
      ...message,
      type: "message",
    }));

  const allMessages: (
    | (ConversationMessage & { type: "message" })
    | (TestRun & { type: "test-run" })
  )[] = [...messageList, ...testRunList].sort(
    (a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0),
  );

  return (
    <div className="flex flex-col w-full gap-4">
      {allMessages.map((message, index) => {
        if (message.type === "message") {
          if (!message.rawContent.length) return null;
          return (
            <MessageItem key={`${message.id ?? index}`} message={message} />
          );
        }
        return <TestRunItem key={`${message.id ?? index}`} testRun={message} />;
      })}

      {isThinking && (
        <div key="thinking" className="flex items-start">
          <Avatar className="size-6 rounded-md">
            <AvatarImage src="/logo-solid.svg" alt="Integrator" />
          </Avatar>
          <span className="ml-3 text-sm text-muted-foreground">
            Thinking
            <TypingDots />
          </span>
        </div>
      )}

      {isGenerating && (
        <div key="generating" className="flex items-start">
          <Avatar className="size-6 rounded-md">
            <AvatarImage src="/logo-solid.svg" alt="Integrator" />
          </Avatar>
          <span className="ml-3 text-sm text-muted-foreground">
            Building
            <TypingDots />
          </span>
        </div>
      )}

      {isRunning && (
        <div key="running" className="flex items-start">
          <Avatar className="size-6 rounded-md">
            <AvatarImage src="/logo-solid.svg" alt="Integrator" />
          </Avatar>
          <span className="ml-3 text-sm text-muted-foreground">
            Running your function
            <TypingDots />
          </span>
        </div>
      )}
    </div>
  );
}

function MessageItem({ message }: { message: ConversationMessage }) {
  return (
    <div className="flex w-full items-start" key={message.id}>
      <Avatar className="size-6 rounded-md">
        {message.role === "user" ? (
          <>
            <AvatarImage src={undefined} alt="User" />
            <AvatarFallback>
              <div className="size-full bg-gradient-to-br from-rose-500 via-amber-600 to-blue-500" />
            </AvatarFallback>
          </>
        ) : (
          <AvatarImage src="/logo-solid.svg" alt="Integrator" />
        )}
      </Avatar>
      <div className="ml-3">
        <RawContentViewer rawContent={message.rawContent ?? []} />
      </div>
    </div>
  );
}

function TestRunItem({ testRun }: { testRun: TestRun }) {
  const stdout = testRun.stdout
    ? (() => {
        // Find the JSON part of the output using regex
        const jsonMatch = testRun.stdout?.match(/\{.*\}/s);
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
      <div className="flex ml-3 w-full h-48 bg-background rounded-md">
        <ScrollArea className="w-full max-h-48 px-1 py-2">
          <pre>
            {testRun.stderr && (
              <p className="text-xs text-red-500">{testRun.stderr}</p>
            )}
            {testRun.stdout && <JsonViewer data={stdout ?? {}} />}
          </pre>
        </ScrollArea>
      </div>
    </div>
  );
}
