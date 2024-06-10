"use client";

import type { EditorState, LexicalEditor } from "lexical";
import { AutoFocusPlugin } from "@lexical/react/LexicalAutoFocusPlugin";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { $getRoot, $getSelection } from "lexical";

import { ResourceNode } from "~/components/editor/nodes/resource-node";
import { ValueNode } from "~/components/editor/nodes/value-node";
import { ReferencesPlugin } from "~/components/editor/plugins/reference-plugin";

function onChange(editorState: EditorState) {
  editorState.read(() => {
    const root = $getRoot();
    const selection = $getSelection();
    console.log(root, selection);
  });
}

function onError(error: Error, _editor: LexicalEditor) {
  console.error(error);
}

export function Editor() {
  const initialConfig = {
    namespace: "editor",
    nodes: [ResourceNode, ValueNode],
    onError,
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="relative flex size-full">
        <RichTextPlugin
          contentEditable={
            <ContentEditable className="flex size-full w-full flex-col rounded-lg border border-input bg-background px-3 py-2 text-sm caret-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" />
          }
          placeholder={
            <div className="absolute px-3 py-2 text-sm text-muted-foreground">
              Describe your function
            </div>
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
      </div>
      <ReferencesPlugin />
      <OnChangePlugin onChange={onChange} />
      <HistoryPlugin />
      <AutoFocusPlugin />
    </LexicalComposer>
  );
}
