"use client";

import { useReactFlow } from "@xyflow/react";
import type {
  DOMExportOutput,
  EditorConfig,
  LexicalEditor,
  LexicalNode,
  SerializedLexicalNode,
  Spread,
} from "lexical";
import { DecoratorNode } from "lexical";
import { HashIcon, TextIcon } from "lucide-react";
import { Suspense } from "react";
import { useForm } from "react-hook-form";

import { Form, FormControl, FormField, FormItem } from "@specly/ui/form";
import { Input } from "@specly/ui/input";

import { toSnakeCase } from "@specly/shared/utils";
import { api } from "~/lib/trpc/react";
import type { FlowNode } from "~/types";

function InputNodeComponent({
  id,
  inputId,
  name,
  testValue,
  inputType,
}: {
  id: string;
  inputId: string;
  name: string;
  inputType: "text" | "number";
  testValue?: string | number | null;
}) {
  const { updateNodeData, getNode } = useReactFlow<FlowNode>();
  const node = getNode(id);

  const form = useForm({
    mode: "onChange",
    defaultValues: {
      name,
      testValue,
    },
  });

  const updateInput = api.primitives.updateInput.useMutation();

  return (
    <div className="inline-flex items-center rounded-md border bg-accent p-1 text-xs text-accent-foreground">
      {inputType === "text" ? (
        <TextIcon className="mr-1 size-3 text-primary" />
      ) : inputType === "number" ? (
        <HashIcon className="mr-1 size-3 text-primary" />
      ) : (
        <></>
      )}
      <form className="flex gap-1">
        <Form {...form}>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    {...field}
                    autoComplete="off"
                    className="h-5 border-none bg-muted px-2 py-1 text-xs"
                    placeholder="Enter input name"
                    onBlur={(e) => {
                      const newValue = toSnakeCase(e.target.value.trim());
                      form.setValue("name", newValue);

                      updateInput.mutate({
                        id,
                        inputId,
                        name: newValue,
                      });

                      updateNodeData(id, {
                        ...node?.data,
                        // @ts-expect-error
                        metadata: {
                          ...node?.data?.metadata,
                          inputs: [
                            ...(node?.data?.metadata?.inputs || []),
                            {
                              id: inputId,
                              name: newValue,
                              testValue: null,
                              type: inputType,
                            },
                          ],
                        },
                      });
                    }}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </Form>
      </form>
    </div>
  );
}

export type SerializedInputNode = Spread<
  {
    id: string;
    inputId: string;
    name: string;
    inputType: "text" | "number";
    testValue?: string | number | null;
  },
  SerializedLexicalNode
>;

export class InputNode extends DecoratorNode<JSX.Element> {
  __id: string;
  __inputId: string;
  __name: string;
  __inputType: "text" | "number";
  __testValue?: string | number | null;

  constructor(
    id: string,
    inputId: string,
    name: string,
    inputType: "text" | "number",
    testValue?: string | number | null,
  ) {
    super();
    this.__id = id;
    this.__inputId = inputId;
    this.__name = name;
    this.__testValue = testValue;
    this.__inputType = inputType;
  }

  static getType(): string {
    return "input";
  }

  static clone(node: InputNode): InputNode {
    return new InputNode(
      node.__id,
      node.__inputId,
      node.__name,
      node.__inputType,
      node.__testValue,
    );
  }

  static importJSON(serializedNode: SerializedInputNode): InputNode {
    const node = $createInputNode(
      serializedNode.id,
      serializedNode.inputId,
      serializedNode.name,
      serializedNode.inputType,
      serializedNode.testValue,
    );
    return node;
  }

  exportJSON(): SerializedInputNode {
    return {
      id: this.__id,
      inputId: this.__inputId,
      name: this.__name,
      testValue: this.__testValue,
      inputType: this.__inputType,
      type: "input",
      version: 1,
    };
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("span");
    element.setAttribute("data-lexical-input", "true");
    return { element };
  }

  createDOM(_config: EditorConfig, _editor: LexicalEditor): HTMLElement {
    const dom = document.createElement("span");
    dom.setAttribute("data-lexical-input", "true");
    return dom;
  }

  updateDOM(): false {
    return false;
  }

  getInputType(): string {
    return this.__type;
  }

  getInputName(): string {
    return this.__name;
  }

  decorate(): JSX.Element {
    return (
      <Suspense fallback={null}>
        <InputNodeComponent
          id={this.__id}
          inputId={this.__inputId}
          name={this.__name}
          testValue={this.__testValue}
          inputType={this.__inputType}
        />
      </Suspense>
    );
  }
}

export function $createInputNode(
  id: string,
  inputId: string,
  name: string,
  inputType: "text" | "number",
  testValue?: string | number | null,
): InputNode {
  return new InputNode(id, inputId, name, inputType, testValue);
}

export function $isInputNode(
  node: LexicalNode | null | undefined,
): node is InputNode {
  return node instanceof InputNode;
}
