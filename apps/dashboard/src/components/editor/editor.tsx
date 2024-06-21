"use client";

import type { InitialConfigType } from "@lexical/react/LexicalComposer";
import type { EditorState, LexicalEditor } from "lexical";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { $getRoot } from "lexical";

import { cn } from "@integramind/ui/utils";

import type { Input } from "~/types";
import { ReferencesPlugin } from "~/components/editor/plugins/reference-plugin";
import { $createInputNode, InputNode } from "./nodes/input-node";
import { ReferenceNode } from "./nodes/reference-node";
import { InputsPlugin } from "./plugins/input-plugin";

interface EditorBaseProps {
  onChange: (editorState: EditorState) => void;
  onError: (error: Error, editor: LexicalEditor) => void;
  className?: string;
  placeholder?: string;
}

interface InputsEditorProps {
  id: string;
  type: "inputs";
  inputs: Input[];
}

interface DescriptionEditorProps {
  type: "description";
  inputs: string[];
}

type EditorProps =
  | (EditorBaseProps & InputsEditorProps)
  | (EditorBaseProps & DescriptionEditorProps);

export function Editor({ ...props }: EditorProps) {
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
    if (props.type === "inputs") {
      props.inputs.forEach((input) => {
        root.append(
          $createInputNode(props.id, input.id, input.name, input.type),
        );
      });
    }
  }

  const initialConfig: InitialConfigType = {
    namespace: "editor",
    nodes,
    editorState: $getEditorState,
    onError: props.onError,
    editable: true,
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="relative flex size-full">
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              className={cn(
                "inline-flex size-full cursor-text flex-col overflow-y-auto rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                props.className,
              )}
            />
          }
          placeholder={
            <div className="absolute px-3.5 py-2 text-sm text-muted-foreground">
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
