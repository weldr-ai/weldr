"use client";

import type { InitialConfigType } from "@lexical/react/LexicalComposer";
import type { EditorState, LexicalEditor } from "lexical";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";

import { DataResourceNode } from "~/components/editor/nodes/data-resource-node";
import { ValueNode } from "~/components/editor/nodes/value-node";
import { ReferencesPlugin } from "~/components/editor/plugins/reference-plugin";

export function Editor({
  onChange,
  onError,
}: {
  onChange: (editorState: EditorState) => void;
  onError: (error: Error, _editor: LexicalEditor) => void;
}) {
  const initialConfig: InitialConfigType = {
    namespace: "editor",
    nodes: [DataResourceNode, ValueNode],
    onError,
    editable: true,
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="relative flex size-full">
        <RichTextPlugin
          contentEditable={
            <ContentEditable className="flex size-full cursor-text flex-col rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" />
          }
          placeholder={
            <div className="absolute px-3.5 py-2 text-sm text-muted-foreground">
              Describe your function
            </div>
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        <ReferencesPlugin />
      </div>
      <OnChangePlugin onChange={onChange} />
      <HistoryPlugin />
    </LexicalComposer>
  );
}
