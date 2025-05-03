"use client";

import type React from "react";
import {
  type ChangeEvent,
  type Dispatch,
  type SetStateAction,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import type { TPendingMessage } from "@/types";
import type { Attachment, UserMessageRawContent } from "@weldr/shared/types";
import { rawContentReferenceElementSchema } from "@weldr/shared/validators/common";
import { Button } from "@weldr/ui/components/button";
import { Textarea } from "@weldr/ui/components/textarea";
import { toast } from "@weldr/ui/hooks/use-toast";
import { LogoIcon } from "@weldr/ui/icons";
import { cn } from "@weldr/ui/lib/utils";
import equal from "fast-deep-equal";
import {
  $getRoot,
  type EditorState,
  type LexicalEditor,
  type ParagraphNode,
} from "lexical";
import { ArrowUpIcon, PaperclipIcon } from "lucide-react";
import type { z } from "zod";
import { Editor } from "./editor";
import type { ReferenceNode } from "./editor/plugins/reference/node";
import { PreviewAttachment } from "./preview-attachment";

type BaseMultimodalInputProps = {
  type: "textarea" | "editor";
  chatId: string;
  attachments: Attachment[];
  setAttachments: Dispatch<SetStateAction<Attachment[]>>;
  handleSubmit: (event?: { preventDefault?: () => void }) => void;
  pendingMessage: TPendingMessage;
  placeholder?: string;
  placeholders?: string[];
  references?: z.infer<typeof rawContentReferenceElementSchema>[];
  formClassName?: string;
  attachmentsClassName?: string;
  textareaClassName?: string;
};

type EditorMultimodalInputProps = BaseMultimodalInputProps & {
  type: "editor";
  message: UserMessageRawContent;
  setMessage: Dispatch<SetStateAction<UserMessageRawContent>>;
};

type TextareaMultimodalInputProps = BaseMultimodalInputProps & {
  type: "textarea";
  message: string;
  setMessage: (message: string) => void;
};

type MultimodalInputProps =
  | EditorMultimodalInputProps
  | TextareaMultimodalInputProps;

function PureMultimodalInput({
  type,
  chatId,
  attachments,
  setAttachments,
  pendingMessage,
  handleSubmit,
  message,
  setMessage,
  placeholder,
  placeholders,
  references,
  formClassName,
  attachmentsClassName,
  textareaClassName,
}: MultimodalInputProps) {
  const [currentPlaceholder, setCurrentPlaceholder] = useState(
    placeholder ?? "Send a message...",
  );

  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editorRef = useRef<LexicalEditor | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<string[]>([]);

  const submitForm = useCallback(() => {
    handleSubmit();

    const editor = editorRef.current;

    if (editor !== null) {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
      });
    }

    if (type === "editor") {
      setMessage([]);
    }

    if (type === "textarea") {
      setMessage("");
    }

    setAttachments([]);
  }, [handleSubmit, setAttachments, setMessage, type]);

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    if (chatId) {
      formData.append("chatId", chatId);
    }

    try {
      const response = await fetch("/api/attachments", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        const { id, name, key, contentType, size, url } = data as {
          id: string;
          name: string;
          key: string;
          contentType: string;
          size: number;
          url: string;
        };

        return {
          id,
          name,
          key,
          contentType,
          size,
          url,
        };
      }

      const { error } = await response.json();

      toast({
        variant: "destructive",
        title: "Something went wrong!",
        description: error,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Something went wrong!",
        description: "Failed to upload file, please try again!",
      });
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);

      setUploadQueue(files.map((file) => file.name));

      try {
        const uploadPromises = files.map((file) => uploadFile(file));
        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) => attachment !== undefined,
        );

        setAttachments((currentAttachments: Attachment[]) => [
          ...currentAttachments,
          ...successfullyUploadedAttachments,
        ]);
      } catch (error) {
        console.error("Error uploading files!", error);
      } finally {
        setUploadQueue([]);
      }
    },
    [setAttachments],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  const handlePaste = useCallback(
    async (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;

      const files: File[] = [];
      for (const item of Array.from(items)) {
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }

      if (files.length === 0) return;

      // Prevent default paste behavior for files
      event.preventDefault();

      setUploadQueue(files.map((file) => file.name));

      try {
        const uploadPromises = files.map((file) => uploadFile(file));
        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) => attachment !== undefined,
        );

        setAttachments((currentAttachments: Attachment[]) => [
          ...currentAttachments,
          ...successfullyUploadedAttachments,
        ]);
      } catch (error) {
        console.error("Error uploading pasted files!", error);
      } finally {
        setUploadQueue([]);
      }
    },
    [setAttachments],
  );

  // Add effect to handle paste events
  useEffect(() => {
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  useEffect(() => {
    if (!placeholders) return;

    let charIndex = 0;
    let isDeleting = false;
    const currentPlaceholder = placeholders[placeholderIndex];

    if (message.length > 0) {
      setCurrentPlaceholder("");
      return;
    }

    const interval = setInterval(() => {
      if (!isDeleting) {
        setCurrentPlaceholder(currentPlaceholder?.slice(0, charIndex) ?? "");
        charIndex++;

        if (charIndex > (currentPlaceholder?.length ?? 0)) {
          isDeleting = true;
          return;
        }
      } else {
        charIndex--;
        setCurrentPlaceholder(currentPlaceholder?.slice(0, charIndex) ?? "");

        if (charIndex === 0) {
          isDeleting = false;
          setPlaceholderIndex((prev) => (prev + 1) % placeholders.length);
          return;
        }
      }
    }, 50);

    return () => clearInterval(interval);
  }, [placeholderIndex, message, placeholders]);

  function onChange(editorState: EditorState) {
    if (type !== "editor") return;

    editorState.read(async () => {
      const root = $getRoot();
      const children = (root.getChildren()[0] as ParagraphNode)?.getChildren();

      const message = children?.reduce((acc, child) => {
        if (child.__type === "text") {
          acc.push({
            type: "paragraph",
            value: child.getTextContent(),
          });
        }

        if (child.__type === "reference") {
          const referenceNode = child as ReferenceNode;
          acc.push(
            rawContentReferenceElementSchema.parse(referenceNode.__reference),
          );
        }

        return acc;
      }, [] as UserMessageRawContent);

      setMessage(message);
    });
  }

  return (
    <div className="flex flex-col items-center justify-center">
      {pendingMessage && (
        <div className="flex w-[calc(100%-30px)] items-center gap-1 rounded-t-md border-x border-t bg-background p-1 text-xs">
          <LogoIcon className="size-4" />
          <span className="inline-flex w-fit animate-shine bg-[length:200%_100%] bg-[linear-gradient(90deg,var(--color-muted-foreground)_0%,var(--color-muted-foreground)_40%,var(--color-foreground)_50%,var(--color-muted-foreground)_60%,var(--color-muted-foreground)_100%)] bg-clip-text text-transparent">
            {pendingMessage.charAt(0).toUpperCase() + pendingMessage.slice(1)}
            ...
          </span>
        </div>
      )}
      <form
        className={cn(
          "relative flex w-full flex-col rounded-xl border",
          formClassName,
        )}
      >
        <input
          type="file"
          className="hidden"
          ref={fileInputRef}
          multiple
          onChange={handleFileChange}
          tabIndex={-1}
        />

        {(attachments.length > 0 || uploadQueue.length > 0) && (
          <div
            className={cn(
              "scrollbar-thin scrollbar-thumb-rounded-full scrollbar-thumb-muted-foreground scrollbar-track-transparent flex flex-row items-start gap-2 overflow-x-auto rounded-t-xl border-b p-2 dark:bg-muted",
              attachmentsClassName,
              {
                "pb-0": attachments.length > 2,
              },
            )}
          >
            {attachments.map((attachment) => (
              <PreviewAttachment
                key={attachment.id}
                attachment={attachment}
                onDelete={() => {
                  if (!attachment.name) return;
                  fetch("/api/attachments", {
                    method: "DELETE",
                    body: JSON.stringify({ filename: attachment.name }),
                  });
                  setAttachments((currentAttachments) =>
                    currentAttachments.filter(
                      (a) => a.name !== attachment.name,
                    ),
                  );
                }}
              />
            ))}

            {uploadQueue.map((filename) => (
              <PreviewAttachment
                key={filename}
                attachment={{
                  id: "",
                  key: "",
                  size: 0,
                  url: "",
                  name: filename,
                  contentType: "",
                }}
                isUploading={true}
              />
            ))}
          </div>
        )}

        {type === "editor" && (
          <Editor
            id="general-chat-input"
            placeholder={currentPlaceholder}
            onChange={onChange}
            className={cn(
              "max-h-[calc(75dvh)] min-h-[128px] resize-none overflow-y-auto rounded-xl border-none bg-background pb-10 dark:bg-background",
              {
                "rounded-t-none border-t-0": attachments.length > 0,
              },
              textareaClassName,
            )}
            editorRef={editorRef}
            disabled={!!pendingMessage}
            onSubmit={handleSubmit}
            references={references}
            typeaheadPosition={"bottom"}
          />
        )}

        {type === "textarea" && (
          <Textarea
            ref={textareaRef}
            placeholder={currentPlaceholder}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className={cn(
              "max-h-[calc(75dvh)] min-h-[128px] resize-none overflow-y-auto rounded-xl border-none bg-background pb-10 dark:bg-background",
              {
                "rounded-t-none border-t-0": attachments.length > 0,
              },
              textareaClassName,
            )}
            rows={2}
            autoFocus
            disabled={!!pendingMessage}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                if (pendingMessage) {
                  toast({
                    description:
                      "Please wait for the model to finish its response!",
                  });
                } else {
                  submitForm();
                }
              }
            }}
          />
        )}

        <div className="absolute bottom-2 left-2 flex w-fit flex-row justify-start">
          <AttachmentsButton
            fileInputRef={fileInputRef}
            pendingMessage={pendingMessage}
          />
        </div>

        <div className="absolute right-2 bottom-2 flex w-fit flex-row justify-end">
          <SendButton
            message={message}
            submitForm={submitForm}
            uploadQueue={uploadQueue}
          />
        </div>
      </form>
    </div>
  );
}

export const MultimodalInput = memo(
  PureMultimodalInput,
  (prevProps, nextProps) => {
    if (!equal(prevProps.message, nextProps.message)) return false;
    if (prevProps.pendingMessage !== nextProps.pendingMessage) return false;
    if (!equal(prevProps.attachments, nextProps.attachments)) return false;
    return true;
  },
);

function PureAttachmentsButton({
  fileInputRef,
  pendingMessage,
}: {
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  pendingMessage: TPendingMessage;
}) {
  return (
    <Button
      variant="outline"
      className="size-7 rounded-full"
      onClick={(event) => {
        event.preventDefault();
        fileInputRef.current?.click();
      }}
      disabled={
        pendingMessage === "thinking" ||
        pendingMessage === "waiting" ||
        pendingMessage === "building"
      }
    >
      <PaperclipIcon className="size-3" />
    </Button>
  );
}

const AttachmentsButton = memo(PureAttachmentsButton);

type SendButtonProps = {
  submitForm: () => void;
  message: UserMessageRawContent | string;
  uploadQueue: string[];
};

function PureSendButton({ submitForm, message, uploadQueue }: SendButtonProps) {
  return (
    <Button
      className="size-7 rounded-full"
      onClick={(event) => {
        event.preventDefault();
        submitForm();
      }}
      disabled={(message && message.length === 0) || uploadQueue.length > 0}
    >
      <ArrowUpIcon className="size-3" />
    </Button>
  );
}

const SendButton = memo(PureSendButton, (prevProps, nextProps) => {
  if (prevProps.uploadQueue.length !== nextProps.uploadQueue.length) {
    return false;
  }

  if (
    typeof prevProps.message === "string" &&
    typeof nextProps.message === "string" &&
    prevProps.message === nextProps.message
  ) {
    return false;
  }

  if (
    Array.isArray(prevProps.message) &&
    Array.isArray(nextProps.message) &&
    !equal(prevProps.message, nextProps.message)
  ) {
    return false;
  }

  return true;
});
