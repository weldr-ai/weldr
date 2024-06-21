import type {
  DOMExportOutput,
  EditorConfig,
  LexicalEditor,
  LexicalNode,
  SerializedLexicalNode,
  Spread,
} from "lexical";
import type { ReactNode } from "react";
import { DecoratorNode } from "lexical";
import { VariableIcon } from "lucide-react";

import { PostgresIcon } from "~/components/icons/postgres-icon";

export type SerializedReferenceNode = Spread<
  {
    id: string;
    name: string;
    referenceType: "input" | "data-resource";
  },
  SerializedLexicalNode
>;

function ReferenceNodeComponent({
  name,
  referenceType,
}: {
  name: string;
  referenceType: "input" | "data-resource";
}) {
  return (
    <div className="inline-flex items-center rounded-md border bg-accent px-1.5 py-0.5 text-xs text-accent-foreground">
      {referenceType === "data-resource" ? (
        <PostgresIcon className="mr-1 size-3 text-primary" />
      ) : (
        <VariableIcon className="mr-1 size-3 text-primary" />
      )}
      {name}
    </div>
  );
}

export class ReferenceNode extends DecoratorNode<ReactNode> {
  __id: string;
  __name: string;
  __referenceType: "input" | "data-resource";

  constructor(
    id: string,
    name: string,
    referenceType: "input" | "data-resource",
  ) {
    super();
    this.__id = id;
    this.__name = name;
    this.__referenceType = referenceType;
  }

  static getType(): string {
    return "reference";
  }

  static clone(node: ReferenceNode): ReferenceNode {
    return new ReferenceNode(node.__id, node.__name, node.__referenceType);
  }

  static importJSON(serializedNode: SerializedReferenceNode): ReferenceNode {
    const node = $createReferenceNode(
      serializedNode.id,
      serializedNode.name,
      serializedNode.referenceType,
    );
    return node;
  }

  exportJSON(): SerializedReferenceNode {
    return {
      id: this.__id,
      name: this.__name,
      type: "reference",
      referenceType: this.__referenceType,
      version: 1,
    };
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("span");
    element.setAttribute("data-lexical-reference", "true");
    return { element };
  }

  createDOM(_config: EditorConfig, _editor: LexicalEditor): HTMLElement {
    const dom = document.createElement("span");
    dom.setAttribute("data-lexical-reference", "true");
    return dom;
  }

  updateDOM(): false {
    return false;
  }

  decorate(): JSX.Element {
    return (
      <ReferenceNodeComponent
        name={this.__name}
        referenceType={this.__referenceType}
      />
    );
  }
}

export function $createReferenceNode(
  id: string,
  name: string,
  referenceType: "input" | "data-resource",
): ReferenceNode {
  return new ReferenceNode(id, name, referenceType);
}

export function $isReferenceNode(
  node: LexicalNode | null | undefined,
): node is ReferenceNode {
  return node instanceof ReferenceNode;
}
