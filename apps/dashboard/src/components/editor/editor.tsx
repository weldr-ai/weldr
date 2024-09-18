"use client";

import type { InitialConfigType } from "@lexical/react/LexicalComposer";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import type { EditorState, LexicalEditor } from "lexical";
import { $createParagraphNode, $createTextNode, $getRoot } from "lexical";

import { cn } from "@specly/ui/utils";

import type {
  FunctionPrimitive,
  Input,
  RawDescription,
  ResponsePrimitive,
} from "@specly/shared/types";
import { ReferencesPlugin } from "~/components/editor/plugins/reference-plugin";
import { $createInputNode, InputNode } from "./nodes/input-node";
import { $createReferenceNode, ReferenceNode } from "./nodes/reference-node";
import { InputsPlugin } from "./plugins/input-plugin";

interface EditorBaseProps {
  id: string;
  type: "description" | "inputs" | "chat";
  placeholder?: string;
  onChange: (editorState: EditorState) => void;
  onError: (error: Error, editor: LexicalEditor) => void;
  className?: string;
}

type EditorProps =
  | ({
      type: "description";
      primitive: FunctionPrimitive | ResponsePrimitive;
      inputs: Input[];
    } & EditorBaseProps)
  | ({
      type: "inputs";
      inputs: Input[];
    } & EditorBaseProps)
  | ({
      type: "chat";
      rawMessage: RawDescription[];
    } & EditorBaseProps);

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
    const paragraph = $createParagraphNode();

    if (props.type === "inputs") {
      for (const input of props.inputs) {
        paragraph.append(
          $createInputNode(
            props.id,
            input.id,
            input.name,
            input.type as "text" | "number",
            input.testValue,
          ),
        );
        paragraph.append($createTextNode(" "));
      }
    }

    const rawDescription =
      (props.type === "description"
        ? props.primitive.metadata.rawDescription
        : props.type === "chat"
          ? props.rawMessage
          : undefined) ?? [];

    for (const item of rawDescription) {
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
    onError: props.onError,
    nodes,
    editable: true,
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="flex size-full">
        {props.type === "inputs" && <InputsPlugin id={props.id} />}
        {props.type === "description" && (
          <ReferencesPlugin
            inputs={props.inputs ?? []}
            primitiveResources={
              props.primitive?.metadata.resources?.map(
                (resource) => resource.id,
              ) ?? []
            }
          />
        )}
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
    </LexicalComposer>
  );
}
