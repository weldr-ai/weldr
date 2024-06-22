import type {
  DOMExportOutput,
  EditorConfig,
  LexicalEditor,
  LexicalNode,
  SerializedLexicalNode,
  Spread,
} from "lexical";
import { Suspense } from "react";
import { DecoratorNode } from "lexical";
import { HashIcon, TextIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { useReactFlow } from "reactflow";

import { Form, FormControl, FormField, FormItem } from "@integramind/ui/form";
import { Input } from "@integramind/ui/input";

import type { FlowNode } from "~/types";
import { updateInput } from "~/lib/queries/primitives";

function InputNodeComponent({
  id,
  inputId,
  name,
  inputType,
}: {
  id: string;
  inputId: string;
  name: string;
  inputType: "text" | "number";
}) {
  const reactFlow = useReactFlow<FlowNode>();
  const form = useForm({
    mode: "onChange",
    defaultValues: {
      name,
    },
  });

  return (
    <div className="inline-flex items-center rounded-md border bg-accent p-1 text-xs text-accent-foreground">
      {inputType === "text" ? (
        <TextIcon className="mr-1 size-3 text-primary" />
      ) : inputType === "number" ? (
        <HashIcon className="mr-1 size-3 text-primary" />
      ) : (
        <></>
      )}
      <form>
        <Form {...form}>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    {...field}
                    className="h-5 w-20 border-none bg-muted px-2 py-1 text-xs"
                    placeholder="Enter input name"
                    onBlur={async (e) => {
                      const inputs = await updateInput({
                        id,
                        inputId,
                        name: e.target.value,
                      });
                      reactFlow.setNodes((nodes) =>
                        nodes.map((node) => {
                          if (node.id === id) {
                            return {
                              ...node,
                              data: {
                                ...node.data,
                                inputs,
                              },
                            };
                          }
                          return node;
                        }),
                      );
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
  },
  SerializedLexicalNode
>;

export class InputNode extends DecoratorNode<JSX.Element> {
  __id: string;
  __inputId: string;
  __name: string;
  __inputType: "text" | "number";

  constructor(
    id: string,
    inputId: string,
    name: string,
    inputType: "text" | "number",
  ) {
    super();
    this.__id = id;
    this.__inputId = inputId;
    this.__name = name;
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
    );
  }

  static importJSON(serializedNode: SerializedInputNode): InputNode {
    const node = $createInputNode(
      serializedNode.id,
      serializedNode.inputId,
      serializedNode.name,
      serializedNode.inputType,
    );
    return node;
  }

  exportJSON(): SerializedInputNode {
    return {
      id: this.__id,
      inputId: this.__inputId,
      name: this.__name,
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
): InputNode {
  return new InputNode(id, inputId, name, inputType);
}

export function $isInputNode(
  node: LexicalNode | null | undefined,
): node is InputNode {
  return node instanceof InputNode;
}
