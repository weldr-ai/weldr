import { useAuth } from "@integramind/auth/provider";
import type {
  ConversationMessage,
  RawContent,
  TestExecutionMessageRawContent,
} from "@integramind/shared/types";
import { testExecutionMessageRawContentSchema } from "@integramind/shared/validators/conversations";
import { Avatar, AvatarFallback, AvatarImage } from "@integramind/ui/avatar";
import { Button } from "@integramind/ui/button";
import { ScrollArea } from "@integramind/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@integramind/ui/tooltip";
import { HistoryIcon } from "lucide-react";
import Image from "next/image";
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
  currentVersionId,
  messages,
  isRunning,
  isThinking,
  isBuilding,
}: {
  currentVersionId: string | undefined | null;
  messages: ConversationMessage[];
  isRunning?: boolean;
  isThinking: boolean;
  isBuilding?: boolean;
}) {
  return (
    <div className="flex w-full flex-col gap-4">
      {messages.map((message, index) => {
        if (!message.rawContent) return null;
        return (
          <MessageItem
            key={`${message.id ?? index}`}
            message={message}
            currentVersionId={currentVersionId}
          />
        );
      })}

      {isThinking && (
        <div key="thinking" className="flex items-start">
          <Avatar className="size-6 rounded-md">
            <AvatarImage src="/logo-solid.svg" alt="Integrator" />
          </Avatar>
          <span className="ml-3 text-muted-foreground text-sm">
            Thinking
            <TypingDots />
          </span>
        </div>
      )}

      {isBuilding && (
        <div key="generating" className="flex items-start">
          <Avatar className="size-6 rounded-md">
            <AvatarImage src="/logo-solid.svg" alt="Integrator" />
          </Avatar>
          <span className="ml-3 text-muted-foreground text-sm">
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
  currentVersionId,
}: {
  message: ConversationMessage;
  currentVersionId: string | undefined | null;
}) {
  const { user } = useAuth();

  const isTestExecution = testExecutionMessageRawContentSchema.safeParse(
    message.rawContent,
  ).success;

  return (
    <div className="flex w-full items-start" key={message.id}>
      <Avatar className="size-6 rounded-md">
        {message.role === "user" ? (
          <>
            <AvatarImage src={user?.image ?? undefined} alt="User" />
            <AvatarFallback>
              <Image
                src={`${process.env.NEXT_PUBLIC_EDITOR_BASE_URL}/api/avatars/${user?.email}`}
                alt="User"
                width={32}
                height={32}
              />
            </AvatarFallback>
          </>
        ) : (
          <AvatarImage src="/logo-solid.svg" alt="Integrator" />
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
        {message.funcVersion && (
          <div className="group flex h-7 items-center gap-2">
            <div className="inline-flex h-7 items-center justify-center rounded-md border border-success bg-success/10 px-2 py-1 text-success text-xs">
              {`#${message.funcVersion.versionNumber} `}
              {message.funcVersion.versionTitle}
            </div>
            {message.funcVersion.id !== currentVersionId && (
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
            )}
          </div>
        )}
        {message.endpointVersion && (
          <div className="group flex h-7 items-center gap-2">
            <div className="inline-flex h-7 items-center justify-center rounded-md border border-success bg-success/10 px-2 py-1 text-success text-xs">
              {`#${message.endpointVersion.versionNumber} `}
              {message.endpointVersion.versionTitle}
            </div>
            {message.endpointVersion.id !== currentVersionId && (
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
            )}
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
