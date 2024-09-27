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
import { $createParagraphNode, $createTextNode, $getRoot } from "lexical";

import { cn } from "@specly/ui/utils";

import type { FlatInputSchema, RawDescription } from "@specly/shared/types";
import { ReferencesPlugin } from "~/components/editor/plugins/reference-plugin";
import { $createReferenceNode, ReferenceNode } from "./nodes/reference-node";

interface EditorProps {
  id: string;
  placeholder?: string;
  onChange: (editorState: EditorState) => void;
  onError?: (error: Error, editor: LexicalEditor) => void;
  className?: string;
  editorRef?: { current: null | LexicalEditor };
  rawMessage?: RawDescription[];
  inputSchema?: FlatInputSchema[];
}

export function Editor({ ...props }: EditorProps) {
  const nodes = [];
  nodes.push(ReferenceNode);

  function $getEditorState() {
    const root = $getRoot();
    const paragraph = $createParagraphNode();

    for (const item of props.rawMessage ?? []) {
      if (item.type === "text") {
        paragraph.append($createTextNode(item.value));
      } else if (item.type === "reference") {
        const referenceNode = $createReferenceNode(
          item.id,
          item.name,
          item.referenceType,
          item.icon,
          item.dataType,
        );
        paragraph.append(referenceNode);
      }
    }

    root.append(paragraph);
  }

  const initialConfig: InitialConfigType = {
    namespace: `editor-${props.id}`,
    editorState: $getEditorState,
    onError: props.onError ?? (() => {}),
    nodes,
    editable: true,
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="flex size-full">
        <ReferencesPlugin inputSchema={props.inputSchema ?? []} />
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              className={cn(
                "size-full cursor-text min-h-[100px] h-full flex-col overflow-y-auto rounded-lg border border-input bg-background p-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                props.className,
              )}
            />
          }
          placeholder={
            <div className="pointer-events-none absolute px-2.5 py-2 text-sm text-muted-foreground">
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
