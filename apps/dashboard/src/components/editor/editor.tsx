"use client";

import type { InitialConfigType } from "@lexical/react/LexicalComposer";
import type { EditorState, LexicalEditor } from "lexical";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { $createParagraphNode, $createTextNode, $getRoot } from "lexical";

import { cn } from "@integramind/ui/utils";

import type { Input } from "~/types";
import { ReferencesPlugin } from "~/components/editor/plugins/reference-plugin";
import { $createInputNode, InputNode } from "./nodes/input-node";
import { ReferenceNode } from "./nodes/reference-node";
import { InputsPlugin } from "./plugins/input-plugin";

interface EditorBaseProps {
  id: string;
  type: "description" | "inputs";
  onChange: (editorState: EditorState) => void;
  onError: (error: Error, editor: LexicalEditor) => void;
  className?: string;
  placeholder?: string;
  inputs: Input[];
}

export function Editor({ ...props }: EditorBaseProps) {
  const nodes = [];

  switch (props.type) {
    case "inputs":
      nodes.push(InputNode);
      break;
    case "description":
      nodes.push(ReferenceNode);
      break;
  }

  function $getEditorState() {
    const root = $getRoot();
    const paragraph = $createParagraphNode();
    if (props.type === "inputs") {
      props.inputs.forEach((input) => {
        paragraph.append(
          $createInputNode(props.id, input.id, input.name, input.type),
        );
        paragraph.append($createTextNode(" "));
      });
    }
    root.append(paragraph);
  }

  const initialConfig: InitialConfigType = {
    namespace: `editor-${props.id}`,
    editorState: $getEditorState,
    onError: props.onError,
    nodes,
    editable: true,
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="relative flex size-full">
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              className={cn(
                "size-full cursor-text flex-col overflow-y-auto rounded-lg border border-input bg-background p-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                props.className,
              )}
            />
          }
          placeholder={
            <div className="pointer-events-none absolute px-2.5 py-2 text-sm text-muted-foreground">
              {props.placeholder}
            </div>
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        {props.type === "inputs" && <InputsPlugin id={props.id} />}
        {props.type === "description" && (
          <ReferencesPlugin inputs={props.inputs} />
        )}
      </div>
      <OnChangePlugin onChange={props.onChange} />
      <HistoryPlugin />
    </LexicalComposer>
  );
}
