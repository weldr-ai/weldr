import { memo, useEffect } from "react";

import type { RouterOutputs } from "@weldr/api";
import { authClient } from "@weldr/auth/client";
import { cn } from "@weldr/ui/lib/utils";

import { useChatVisibility } from "@/hooks/use-chat-visibility";
import { useEditorReferences } from "@/hooks/use-editor-references";
import { useEventStream } from "@/hooks/use-event-stream";
import { useMessages } from "@/hooks/use-messages";
import { useScrollToBottom } from "@/hooks/use-scroll-to-bottom";
import { useStatus } from "@/hooks/use-status";
import { useWorkflowTrigger } from "@/hooks/use-workflow-trigger";
import { parseConventionalCommit } from "@/lib/utils";
import { CommitTypeBadge } from "../commit-type-badge";
import { Messages } from "./messages";
import { MultimodalInput } from "./multimodal-input/multimodal-input";

interface ChatProps {
  integrationTemplates: RouterOutputs["integrationTemplates"]["list"];
  project: RouterOutputs["projects"]["byId"];
}

export const Chat = memo<ChatProps>(({ integrationTemplates, project }) => {
  const { data: session } = authClient.useSession();
  const headVersion = project.branch.headVersion;

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
      headVersion.status === "completed" ? [] : headVersion.chat.messages,
    chatId: headVersion.chat.id,
    session,
  });

  const [messagesContainerRef, messagesEndRef] =
    useScrollToBottom<HTMLDivElement>(messages);

  const { status, setStatus } = useStatus({
    version: headVersion,
    messages,
    project,
  });

  const { isChatVisible, chatContainerRef, handleInputFocus } =
    useChatVisibility();

  const { eventSourceRef, connectToEventStream, closeEventStream } =
    useEventStream({
      projectId: project.id,
      // TODO: get current branch id
      branchId: project.branch.id,
      chatId: headVersion.chat.id,
      project,
      setStatus,
      setMessages,
    });

  const { triggerGeneration } = useWorkflowTrigger({
    projectId: project.id,
    // TODO: get current branch id
    branchId: project.branch.id,
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

  const editorReferences = useEditorReferences({ version: headVersion });

  useEffect(() => {
    return () => {
      closeEventStream();
    };
  }, [closeEventStream]);

  const conventionalCommit = parseConventionalCommit(headVersion.message);

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
      <div className="flex w-full items-center gap-2 truncate border-b px-2 py-1 font-medium text-xs">
        <span className="text-muted-foreground">{`#${headVersion.number}`}</span>
        <span className="flex items-center gap-1 truncate">
          {conventionalCommit.type && (
            <CommitTypeBadge type={conventionalCommit.type} />
          )}
          <span className="truncate">
            {conventionalCommit.message ?? "Untitled Version"}
          </span>
        </span>
      </div>

      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out",
          {
            "h-0": !isChatVisible,
            "h-[calc(100vh-274px)]": isChatVisible,
            "h-[calc(100vh-298px)]": isChatVisible && status,
            "h-[calc(100vh-348px)]": isChatVisible && attachments.length > 0,
          },
        )}
      >
        <div
          ref={messagesContainerRef}
          className="scrollbar scrollbar-thumb-rounded-full scrollbar-thumb-muted-foreground scrollbar-track-transparent flex h-full flex-col gap-2 overflow-y-auto border-b p-2"
        >
          <Messages
            messages={messages}
            // TODO: get current branch id
            branchId={project.branch.id}
            integrationTemplates={integrationTemplates}
            environmentVariables={project.environmentVariables}
            setMessages={setMessages}
            setStatus={setStatus}
          />
          <div ref={messagesEndRef} />
        </div>
      </div>

      <MultimodalInput
        type="editor"
        chatId={headVersion.chat.id}
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
    </div>
  );
});
