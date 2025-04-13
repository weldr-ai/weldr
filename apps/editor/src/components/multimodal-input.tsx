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
import type { Attachment } from "@weldr/shared/types";
import { Button } from "@weldr/ui/button";
import { toast } from "@weldr/ui/hooks/use-toast";
import { LogoIcon } from "@weldr/ui/icons/logo-icon";
import { Textarea } from "@weldr/ui/textarea";
import { cn } from "@weldr/ui/utils";
import equal from "fast-deep-equal";
import { ArrowUpIcon, PaperclipIcon } from "lucide-react";
import { PreviewAttachment } from "./preview-attachment";

function PureMultimodalInput({
  chatId,
  message,
  setMessage,
  attachments,
  setAttachments,
  pendingMessage,
  handleSubmit,
  placeholder,
  placeholders,
  formClassName,
  attachmentsClassName,
  textareaClassName,
}: {
  chatId: string;
  message: string;
  setMessage: (message: string) => void;
  attachments: Attachment[];
  setAttachments: Dispatch<SetStateAction<Attachment[]>>;
  handleSubmit: (event?: { preventDefault?: () => void }) => void;
  pendingMessage: TPendingMessage;
  placeholder?: string;
  placeholders?: string[];
  formClassName?: string;
  attachmentsClassName?: string;
  textareaClassName?: string;
}) {
  const [currentPlaceholder, setCurrentPlaceholder] = useState(
    placeholder ?? "Send a message...",
  );

  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<string[]>([]);

  const submitForm = useCallback(() => {
    handleSubmit();
    setMessage("");
    setAttachments([]);
  }, [handleSubmit, setAttachments, setMessage]);

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

    if (message) {
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

  return (
    <div className="flex flex-col items-center justify-center">
      {pendingMessage && (
        <div className="flex w-[calc(100%-30px)] items-center gap-1 rounded-t-md border-x border-t bg-background p-1 text-muted-foreground text-xs">
          <LogoIcon className="size-4 p-0" />
          <span className="inline-flex w-fit animate-shine bg-[length:200%_100%] bg-[linear-gradient(90deg,hsl(var(--muted-foreground))_0%,hsl(var(--muted-foreground))_40%,hsl(var(--foreground))_50%,hsl(var(--muted-foreground))_60%,hsl(var(--muted-foreground))_100%)] bg-clip-text text-transparent">
            {pendingMessage.charAt(0).toUpperCase() + pendingMessage.slice(1)}
            ...
          </span>
        </div>
      )}
      <form
        className={cn(
          "relative flex w-full flex-col rounded-xl border bg-background",
          formClassName,
        )}
      >
        <input
          type="file"
          className="-top-4 -left-4 pointer-events-none fixed size-0.5 opacity-0"
          ref={fileInputRef}
          multiple
          onChange={handleFileChange}
          tabIndex={-1}
        />

        <div
          className={cn(
            "flex flex-row items-end gap-2 overflow-x-scroll rounded-t-xl bg-muted p-2",
            attachmentsClassName,
          )}
        >
          <PreviewAttachment
            attachment={{
              id: "logo",
              key: "logo",
              size: 100,
              url: "https://integramind.ai/logo.svg",
              name: "logo.svg",
              contentType: "image/svg+xml",
            }}
          />

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
                  currentAttachments.filter((a) => a.name !== attachment.name),
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

        <Textarea
          ref={textareaRef}
          placeholder={currentPlaceholder}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          className={cn(
            "!text-base max-h-[calc(75dvh)] min-h-[128px] resize-none overflow-y-auto rounded-xl border-none bg-background pb-10 focus-visible:ring-0",
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
    if (prevProps.message !== nextProps.message) return false;
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
      className="h-fit rounded-lg bg-background p-[7px]"
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

function PureSendButton({
  submitForm,
  message,
  uploadQueue,
}: {
  submitForm: () => void;
  message: string;
  uploadQueue: string[];
}) {
  return (
    <Button
      className="h-fit rounded-full p-[7px]"
      onClick={(event) => {
        event.preventDefault();
        submitForm();
      }}
      disabled={message.length === 0 || uploadQueue.length > 0}
    >
      <ArrowUpIcon className="size-3" />
    </Button>
  );
}

const SendButton = memo(PureSendButton, (prevProps, nextProps) => {
  if (prevProps.uploadQueue.length !== nextProps.uploadQueue.length)
    return false;
  if (prevProps.message !== nextProps.message) return false;
  return true;
});

export const PendingMessage = ({
  type,
}: {
  type: Exclude<TPendingMessage, null>;
}) => {
  return (
    <div key="thinking" className="flex w-full flex-col gap-2">
      <div className="flex items-center gap-1">
        <LogoIcon className="size-6 p-0" />
        <span className="text-muted-foreground text-xs">Weldr</span>
      </div>
      <span className="inline-flex w-fit animate-shine bg-[length:200%_100%] bg-[linear-gradient(90deg,hsl(var(--muted-foreground))_0%,hsl(var(--muted-foreground))_40%,hsl(var(--foreground))_50%,hsl(var(--muted-foreground))_60%,hsl(var(--muted-foreground))_100%)] bg-clip-text text-transparent">
        {type.charAt(0).toUpperCase() + type.slice(1)}
        ...
      </span>
    </div>
  );
};
