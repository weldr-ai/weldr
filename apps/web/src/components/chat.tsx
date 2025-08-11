import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { memo, useEffect } from "react";

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
import { useScrollToBottom } from "@/hooks/use-scroll-to-bottom";
import { useStatus } from "@/hooks/use-status";
import { useWorkflowTrigger } from "@/hooks/use-workflow-trigger";
import { parseConventionalCommit } from "@/lib/utils";
import { CommitTypeBadge } from "./commit-type-badge";
import { Messages } from "./messages";
import { MultimodalInput } from "./multimodal-input";
import { SetupIntegration } from "./setup-integrations";

interface ChatProps {
  integrationTemplates: RouterOutputs["integrationTemplates"]["list"];
  project: RouterOutputs["projects"]["byId"];
}

export const Chat = memo<ChatProps>(({ integrationTemplates, project }) => {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const latestVersion = project.versions[project.versions.length - 1];
  const version = project.currentVersion;

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

  const { status, setStatus } = useStatus({
    version,
    messages,
    project,
  });

  const {
    isChatVisible,
    chatContainerRef,
    handleInputFocus,
    setIsChatVisible,
  } = useChatVisibility();

  const { eventSourceRef, connectToEventStream, closeEventStream } =
    useEventStream({
      projectId: project.id,
      project,
      setStatus,
      setMessages,
    });

  const { triggerGeneration } = useWorkflowTrigger({
    projectId: project.id,
    setStatus,
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
        "flex size-full flex-col justify-end rounded-lg border bg-background dark:bg-muted",
        {
          "transition-all delay-300 ease-in-out": !isChatVisible,
          "transition-none": attachments.length > 0 || isChatVisible,
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
          setStatus={setStatus}
          setIsChatVisible={setIsChatVisible}
          integrationTemplates={integrationTemplates}
          environmentVariables={project.environmentVariables}
        />
      ) : (
        <>
          <div className="flex items-center justify-between gap-1 border-b px-2 py-1 pr-1">
            <span className="flex items-center gap-2 truncate font-medium text-xs">
              <span className="text-muted-foreground">{`#${version.number}`}</span>
              <span className="flex items-center gap-1 truncate">
                {conventionalCommit.type && (
                  <CommitTypeBadge type={conventionalCommit.type} />
                )}
                <span className="truncate">
                  {conventionalCommit.message ?? "Untitled Version"}
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
            className={cn(
              "overflow-hidden transition-all duration-300 ease-in-out",
              {
                "h-0": !isChatVisible,
                "h-[calc(100vh-274px)]": isChatVisible,
                "h-[calc(100vh-298px)]": isChatVisible && status,
                "h-[calc(100vh-348px)]":
                  isChatVisible && attachments.length > 0,
              },
            )}
          >
            <div
              ref={messagesContainerRef}
              className="scrollbar scrollbar-thumb-rounded-full scrollbar-thumb-muted-foreground scrollbar-track-transparent flex h-full flex-col gap-2 overflow-y-auto border-b p-2"
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
            status={status}
            handleSubmit={handleSubmit}
            placeholder="Build with Weldr..."
            references={editorReferences}
            onFocus={handleInputFocus}
          />
        </>
      )}
    </div>
  );
});
