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

import type { Attachment } from "@weldr/shared/types";
import { Button } from "@weldr/ui/button";
import { toast } from "@weldr/ui/hooks/use-toast";
import { Textarea } from "@weldr/ui/textarea";
import { cn } from "@weldr/ui/utils";
import equal from "fast-deep-equal";
import { ArrowUpIcon, PaperclipIcon, StopCircleIcon } from "lucide-react";
import { PreviewAttachment } from "./preview-attachment";

function PureMultimodalInput({
  chatId,
  className,
  input,
  setInput,
  attachments,
  setAttachments,
  isGenerating,
  handleSubmit,
  placeholder,
  placeholders,
}: {
  chatId: string;
  className?: string;
  input: string;
  setInput: (input: string) => void;
  attachments: Attachment[];
  setAttachments: Dispatch<SetStateAction<Attachment[]>>;
  isGenerating?: boolean;
  handleSubmit: (event?: { preventDefault?: () => void }) => void;
  placeholder?: string;
  placeholders?: string[];
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
    setInput("");
    setAttachments([]);
  }, [handleSubmit, setAttachments, setInput]);

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

    if (input) {
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
  }, [placeholderIndex, input, placeholders]);

  return (
    <form className="relative flex w-full flex-col rounded-2xl bg-background">
      <input
        type="file"
        className="-top-4 -left-4 pointer-events-none fixed size-0.5 opacity-0"
        ref={fileInputRef}
        multiple
        onChange={handleFileChange}
        tabIndex={-1}
      />

      {(attachments.length > 0 || uploadQueue.length > 0) && (
        <div className="flex flex-row items-end gap-2 overflow-x-scroll rounded-t-xl bg-muted p-2">
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
      )}

      <Textarea
        ref={textareaRef}
        placeholder={currentPlaceholder}
        value={input}
        onChange={(event) => setInput(event.target.value)}
        className={cn(
          "!text-base max-h-[calc(75dvh)] min-h-[128px] resize-none overflow-y-auto rounded-xl border-none bg-background pb-10 focus-visible:ring-0",
          className,
        )}
        rows={2}
        autoFocus
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            if (isGenerating) {
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
          isGenerating={isGenerating}
        />
      </div>

      <div className="absolute right-2 bottom-2 flex w-fit flex-row justify-end">
        {isGenerating ? (
          <StopButton stop={stop} />
        ) : (
          <SendButton
            input={input}
            submitForm={submitForm}
            uploadQueue={uploadQueue}
          />
        )}
      </div>
    </form>
  );
}

export const MultimodalInput = memo(
  PureMultimodalInput,
  (prevProps, nextProps) => {
    if (prevProps.input !== nextProps.input) return false;
    if (prevProps.isGenerating !== nextProps.isGenerating) return false;
    if (!equal(prevProps.attachments, nextProps.attachments)) return false;
    return true;
  },
);

function PureAttachmentsButton({
  fileInputRef,
  isGenerating,
}: {
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  isGenerating?: boolean;
}) {
  return (
    <Button
      variant="outline"
      className="h-fit rounded-lg bg-background p-[7px]"
      onClick={(event) => {
        event.preventDefault();
        fileInputRef.current?.click();
      }}
      disabled={isGenerating}
    >
      <PaperclipIcon className="size-3" />
    </Button>
  );
}

const AttachmentsButton = memo(PureAttachmentsButton);

function PureStopButton({
  stop,
}: {
  stop: () => void;
}) {
  return (
    <Button
      variant="outline"
      className="h-fit rounded-full bg-background p-1.5"
      onClick={(event) => {
        event.preventDefault();
        stop();
      }}
    >
      <StopCircleIcon className="size-3" />
    </Button>
  );
}

const StopButton = memo(PureStopButton);

function PureSendButton({
  submitForm,
  input,
  uploadQueue,
}: {
  submitForm: () => void;
  input: string;
  uploadQueue: string[];
}) {
  return (
    <Button
      className="h-fit rounded-full p-1.5"
      onClick={(event) => {
        event.preventDefault();
        submitForm();
      }}
      disabled={input.length === 0 || uploadQueue.length > 0}
    >
      <ArrowUpIcon className="size-3" />
    </Button>
  );
}

const SendButton = memo(PureSendButton, (prevProps, nextProps) => {
  if (prevProps.uploadQueue.length !== nextProps.uploadQueue.length)
    return false;
  if (prevProps.input !== nextProps.input) return false;
  return true;
});
