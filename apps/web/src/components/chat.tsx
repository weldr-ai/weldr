import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import type { RouterOutputs } from "@weldr/api";
import { authClient } from "@weldr/auth/client";
import type {
  IntegrationCategoryKey,
  ToolResultPartMessage,
} from "@weldr/shared/types";
import { Button } from "@weldr/ui/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@weldr/ui/components/tooltip";
import { cn } from "@weldr/ui/lib/utils";

import { useChatVisibility } from "@/hooks/use-chat-visibility";
import { useEditorReferences } from "@/hooks/use-editor-references";
import { useEventStream } from "@/hooks/use-event-stream";
import { useMessages } from "@/hooks/use-messages";
import { usePendingMessageStatus } from "@/hooks/use-pending-message-status";
import { useScrollToBottom } from "@/hooks/use-scroll-to-bottom";
import { useWorkflowTrigger } from "@/hooks/use-workflow-trigger";
import { parseConventionalCommit } from "@/lib/utils";
import { CommitTypeBadge } from "./commit-type-badge";
import { Messages } from "./messages";
import { MultimodalInput } from "./multimodal-input";
import { SetupIntegration } from "./setup-integrations";

interface ChatProps {
  version: RouterOutputs["projects"]["byId"]["currentVersion"];
  environmentVariables: RouterOutputs["environmentVariables"]["list"];
  integrationTemplates: RouterOutputs["integrationTemplates"]["list"];
  project: RouterOutputs["projects"]["byId"];
}

export function Chat({
  version,
  environmentVariables,
  integrationTemplates,
  project,
}: ChatProps) {
  const router = useRouter();
  const { data: session } = authClient.useSession();

  const latestVersion = project.versions[project.versions.length - 1];

  const {
    messages,
    setMessages,
    userMessageContent,
    setUserMessageContent,
    attachments,
    setAttachments,
    handleSubmit: handleMessageSubmit,
  } = useMessages({
    initialMessages:
      version.status === "completed" ? [] : version.chat.messages,
    chatId: version.chat.id,
    session,
  });

  const [messagesContainerRef, messagesEndRef] =
    useScrollToBottom<HTMLDivElement>(messages);

  const { pendingMessage, setPendingMessage } = usePendingMessageStatus({
    version,
    messages,
    project,
  });

  const { isChatVisible, chatContainerRef, handleInputFocus } =
    useChatVisibility({
      initialVisibility: project.currentVersion.status !== "completed",
      pendingMessage,
    });

  const { eventSourceRef, connectToEventStream, closeEventStream } =
    useEventStream({
      projectId: project.id,
      project,
      setPendingMessage,
      setMessages,
    });

  const { triggerGeneration } = useWorkflowTrigger({
    projectId: project.id,
    setPendingMessage,
    eventSourceRef,
    connectToEventStream,
  });

  const handleSubmit = async () => {
    await handleMessageSubmit();
    await triggerGeneration({
      content: userMessageContent,
      attachments,
    });
  };

  const editorReferences = useEditorReferences({ latestVersion });

  useEffect(() => {
    return () => {
      closeEventStream();
    };
  }, [closeEventStream]);

  const conventionalCommit = parseConventionalCommit(version.message);

  return (
    <div
      ref={chatContainerRef}
      className={cn(
        "flex size-full max-h-[400px] flex-col justify-end rounded-lg border bg-background dark:bg-muted",
        {
          "transition-all delay-300 ease-in-out":
            !isChatVisible &&
            pendingMessage !== "thinking" &&
            pendingMessage !== "responding" &&
            pendingMessage !== "waiting",
          "transition-none":
            attachments.length > 0 ||
            isChatVisible ||
            pendingMessage === "thinking" ||
            pendingMessage === "responding" ||
            pendingMessage === "waiting",
        },
      )}
    >
      {messages[messages.length - 1]?.role === "tool" &&
      messages[messages.length - 1]?.content.some(
        (content) =>
          content.type === "tool-result" &&
          content.toolName === "add_integrations" &&
          (
            content as ToolResultPartMessage & {
              output: {
                status: "awaiting_config";
                categories: IntegrationCategoryKey[];
              };
            }
          ).output.status === "awaiting_config",
      ) ? (
        <SetupIntegration
          // biome-ignore lint/style/noNonNullAssertion: reason
          message={messages[messages.length - 1]!}
          setMessages={setMessages}
          setPendingMessage={setPendingMessage}
          integrationTemplates={integrationTemplates}
          environmentVariables={environmentVariables}
        />
      ) : (
        <>
          <div
            className={cn(
              "overflow-hidden transition-all duration-300 ease-in-out",
              {
                "h-0":
                  !isChatVisible &&
                  pendingMessage !== "thinking" &&
                  pendingMessage !== "responding" &&
                  pendingMessage !== "waiting",
                "h-[300px]":
                  isChatVisible ||
                  pendingMessage === "thinking" ||
                  pendingMessage === "responding" ||
                  pendingMessage === "waiting",
              },
            )}
          >
            <div className="flex items-center justify-between gap-1 border-b p-1">
              <span className="flex items-center gap-1 truncate font-medium text-xs">
                <span className="text-muted-foreground">{`#${version.number}`}</span>
                <span className="flex items-center gap-1 truncate">
                  {conventionalCommit.type && (
                    <CommitTypeBadge type={conventionalCommit.type} />
                  )}
                  <span className="truncate">
                    {conventionalCommit.message ?? "Chat Title"}
                  </span>
                </span>
              </span>
              <div className="flex items-center gap-0.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      className="size-5 rounded-sm shadow-none"
                      size="icon"
                      disabled={!version.previousVersionId}
                      onClick={() => {
                        if (version.previousVersionId) {
                          router.push(
                            `/projects/${project.id}?versionId=${version.previousVersionId}`,
                          );
                        }
                      }}
                    >
                      <ChevronLeftIcon className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="border bg-background px-2 py-0.5 text-foreground dark:bg-muted">
                    <p>View Previous Version</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      className="size-5 rounded-sm shadow-none"
                      size="icon"
                      disabled={!version.nextVersionId}
                      onClick={() => {
                        if (version.nextVersionId) {
                          router.push(
                            `/projects/${project.id}?versionId=${version.nextVersionId}`,
                          );
                        }
                      }}
                    >
                      <ChevronRightIcon className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="border bg-background px-2 py-0.5 text-foreground dark:bg-muted">
                    <p>View Next Version</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
            <div
              ref={messagesContainerRef}
              className="scrollbar scrollbar-thumb-rounded-full scrollbar-thumb-muted-foreground scrollbar-track-transparent flex h-[calc(100%-33px)] flex-col gap-2 overflow-y-auto border-b p-2"
            >
              <Messages messages={messages} />
              <div ref={messagesEndRef} />
            </div>
          </div>

          <MultimodalInput
            type="editor"
            chatId={version.chat.id}
            message={userMessageContent}
            setMessage={setUserMessageContent}
            attachments={attachments}
            setAttachments={setAttachments}
            pendingMessage={pendingMessage}
            handleSubmit={handleSubmit}
            placeholder="Build with Weldr..."
            references={editorReferences}
            onFocus={handleInputFocus}
            isVisible={isChatVisible}
          />
        </>
      )}
    </div>
  );
}
