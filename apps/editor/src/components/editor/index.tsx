"use client";

import type { InitialConfigType } from "@lexical/react/LexicalComposer";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { EditorRefPlugin } from "@lexical/react/LexicalEditorRefPlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import type { EditorState, LexicalEditor } from "lexical";
import { useEffect } from "react";

import { cn } from "@integramind/ui/utils";

import type { UserMessageRawContent } from "@integramind/shared/types";
import type { userMessageRawContentReferenceElementSchema } from "@integramind/shared/validators/conversations";
import type { z } from "zod";
import { ReferencesPlugin } from "./plugins/reference";
import { ReferenceNode } from "./plugins/reference/node";

interface EditorProps {
  id: string;
  placeholder?: string;
  onChange: (editorState: EditorState) => void;
  className?: string;
  editorRef?: { current: null | LexicalEditor };
  rawMessage?: UserMessageRawContent;
  references?: z.infer<typeof userMessageRawContentReferenceElementSchema>[];
  typeaheadPosition?: "bottom" | "top";
  onSubmit?: () => void;
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
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && props.onSubmit) {
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
            <ContentEditable
              className={cn(
                "size-full h-full min-h-[100px] cursor-text flex-col overflow-y-auto rounded-lg border border-input bg-background p-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                props.className,
              )}
            />
          }
          placeholder={
            <div className="pointer-events-none absolute px-2.5 py-2 text-muted-foreground text-sm">
              {props.placeholder ?? "Start typing..."}
            </div>
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
      </div>
      <OnChangePlugin onChange={props.onChange} />
      <HistoryPlugin />
      {props.editorRef && <EditorRefPlugin editorRef={props.editorRef} />}
    </LexicalComposer>
  );
}
