"use client";

import type { InitialConfigType } from "@lexical/react/LexicalComposer";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { EditorRefPlugin } from "@lexical/react/LexicalEditorRefPlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import type { referencePartSchema } from "@weldr/shared/validators/chats";
import { cn } from "@weldr/ui/lib/utils";
import type { EditorState, LexicalEditor } from "lexical";
import { useEffect } from "react";
import type { z } from "zod";
import { ReferencesPlugin } from "./plugins/reference";
import { ReferenceNode } from "./plugins/reference/node";

interface EditorProps {
  id: string;
  placeholder?: string;
  placeholderClassName?: string;
  onChange?: (editorState: EditorState) => void;
  className?: string;
  editorRef?: { current: null | LexicalEditor };
  references?: z.infer<typeof referencePartSchema>[];
  typeaheadPosition?: "bottom" | "top";
  onSubmit?: () => void;
  disabled?: boolean;
  onFocus?: () => void;
}

export function Editor({ ...props }: EditorProps) {
  const initialConfig: InitialConfigType = {
    namespace: `editor-${props.id}`,
    onError: (error) => {
      console.error(error);
    },
    nodes: [ReferenceNode],
    editable: true,
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && props.onSubmit) {
        e.preventDefault();
        props.onSubmit();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [props.onSubmit]);

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="flex size-full">
        <ReferencesPlugin
          references={props.references ?? []}
          position={props.typeaheadPosition}
        />
        <RichTextPlugin
          contentEditable={
            <div className="size-full">
              <ContentEditable
                className={cn(
                  "flex size-full min-h-9 cursor-text flex-col justify-center overflow-y-auto bg-background px-3 py-1 text-sm focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
                  !props.className &&
                    "rounded-lg border focus-visible:ring-1 focus-visible:ring-ring",
                  props.className,
                )}
                disabled={props.disabled}
                onFocus={props.onFocus}
              />
            </div>
          }
          placeholder={
            <div className="pointer-events-none absolute px-3 py-2 text-muted-foreground text-sm">
              {props.placeholder ?? "Start typing..."}
            </div>
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
      </div>
      {props.onChange && <OnChangePlugin onChange={props.onChange} />}
      <HistoryPlugin />
      {props.editorRef && <EditorRefPlugin editorRef={props.editorRef} />}
    </LexicalComposer>
  );
}
