import { memo, useEffect, useState } from "react";

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
import { Timeline, TimelineContent, TimelineTrigger } from "../timeline";
import { Messages } from "./messages";
import { MultimodalInput } from "./multimodal-input/multimodal-input";

interface ChatProps {
  integrationTemplates: RouterOutputs["integrationTemplates"]["list"];
  project: RouterOutputs["projects"]["byId"];
  branch: RouterOutputs["branches"]["byIdOrMain"];
}

export const Chat = memo<ChatProps>(
  ({ integrationTemplates, project, branch }) => {
    const { data: session } = authClient.useSession();

    const {
      messages,
      setMessages,
      userMessageContent,
      setUserMessageContent,
      attachments,
      setAttachments,
      handleSubmit: handleMessageSubmit,
    } = useMessages({
      initialMessages: branch.headVersion.chat.messages,
      chatId: branch.headVersion.chat.id,
      session,
    });

    const [messagesContainerRef, messagesEndRef] =
      useScrollToBottom<HTMLDivElement>(messages);

    const { status, setStatus } = useStatus({
      version: branch.headVersion,
      messages,
      project,
    });

    const { isChatVisible, chatContainerRef, handleInputFocus } =
      useChatVisibility();

    const [isTimelineOpen, setIsTimelineOpen] = useState(true);

    const { eventSourceRef, connectToEventStream, closeEventStream } =
      useEventStream({
        projectId: project.id,
        branchId: branch.id,
        chatId: branch.headVersion.chat.id,
        branch,
        setStatus,
        setMessages,
      });

    const { triggerGeneration } = useWorkflowTrigger({
      projectId: project.id,
      branchId: branch.id,
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

    const editorReferences = useEditorReferences({
      version: branch.headVersion,
    });

    useEffect(() => {
      return () => {
        closeEventStream();
      };
    }, [closeEventStream]);

    const conventionalCommit = parseConventionalCommit(
      branch.headVersion.message,
    );

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
        <Timeline open={isTimelineOpen} onOpenChange={setIsTimelineOpen}>
          <TimelineContent className="border-b" />
          <div className="flex items-center justify-between gap-2 border-b px-2 py-1 pr-1 text-xs">
            <div className="flex w-full items-center gap-2 truncate font-medium">
              <span className="text-muted-foreground">{`#${branch.headVersion.sequenceNumber}`}</span>
              <span className="flex items-center gap-1 truncate">
                {conventionalCommit.type && (
                  <CommitTypeBadge type={conventionalCommit.type} />
                )}
                <span className="truncate">
                  {conventionalCommit.message ?? "Untitled Version"}
                </span>
              </span>
            </div>
            <TimelineTrigger />
          </div>
        </Timeline>

        <div
          className="overflow-hidden transition-all duration-300 ease-in-out"
          style={{
            height: !isChatVisible
              ? 0
              : `calc(100vh - ${
                  274 + // Base offset
                  (status ? 24 : 0) + // Status bar
                  (attachments.length > 0 ? 74 : 0) + // Attachments
                  (isTimelineOpen ? 146 : 0) // Timeline
                }px)`,
          }}
        >
          <div
            ref={messagesContainerRef}
            className="scrollbar scrollbar-thumb-rounded-full scrollbar-thumb-muted-foreground scrollbar-track-transparent flex h-full flex-col gap-2 overflow-y-auto border-b p-2"
          >
            <Messages
              messages={messages}
              branchId={branch.id}
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
          chatId={branch.headVersion.chat.id}
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
  },
);
