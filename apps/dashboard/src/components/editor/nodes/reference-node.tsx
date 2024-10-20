import type {
  DOMExportOutput,
  EditorConfig,
  LexicalEditor,
  LexicalNode,
  SerializedLexicalNode,
  Spread,
} from "lexical";
import { DecoratorNode } from "lexical";
import type { ReactNode } from "react";

import type { DataType } from "@specly/shared/types";
import { toCamelCase } from "@specly/shared/utils";
import { ReferenceBadge } from "~/components/editor/reference-badge";

export type SerializedReferenceNode = Spread<
  {
    id: string;
    name: string;
    referenceType: "input" | "database" | "database-table" | "database-column";
    dataType?: DataType;
    testValue?: string | number | null;
  },
  SerializedLexicalNode
>;

export class ReferenceNode extends DecoratorNode<ReactNode> {
  __id: string;
  __name: string;
  __referenceType: "input" | "database" | "database-table" | "database-column";
  __dataType?: DataType;
  __testValue?: string | number | null;

  constructor(
    id: string,
    name: string,
    referenceType: "input" | "database" | "database-table" | "database-column",
    dataType?: DataType,
    testValue?: string | number | null,
  ) {
    super();
    this.__id = id;
    this.__name = name;
    this.__referenceType = referenceType;
    this.__dataType = dataType;
    this.__testValue = testValue;
  }

  static getType(): string {
    return "reference";
  }

  static clone(node: ReferenceNode): ReferenceNode {
    return new ReferenceNode(
      node.__id,
      node.__name,
      node.__referenceType,
      node.__dataType,
      node.__testValue,
    );
  }

  static importJSON(serializedNode: SerializedReferenceNode): ReferenceNode {
    const node = $createReferenceNode(
      serializedNode.id,
      serializedNode.name,
      serializedNode.referenceType,
      serializedNode.dataType,
      serializedNode.testValue,
    );
    return node;
  }

  exportJSON(): SerializedReferenceNode {
    return {
      id: this.__id,
      name: this.__name,
      type: "reference",
      referenceType: this.__referenceType,
      dataType: this.__dataType,
      version: 1,
    };
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("span");
    element.setAttribute("data-lexical-reference", "true");
    return { element };
  }

  getTextContent(): string {
    switch (this.__referenceType) {
      case "input":
        return `input '${toCamelCase(this.__name)}' of type '${this.__dataType}'`;
      case "database":
        return `postgres database '${this.__name}' - its id is '${this.__id}'`;
      case "database-table":
        return `table '${this.__name}'`;
      case "database-column":
        return `column '${this.__name}' of type '${this.__dataType}'`;
      default:
        return "";
    }
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
      <ReferenceBadge
        name={this.__name}
        referenceType={this.__referenceType}
        dataType={this.__dataType ?? "null"}
      />
    );
  }
}

export function $createReferenceNode(
  id: string,
  name: string,
  referenceType: "input" | "database" | "database-table" | "database-column",
  dataType?: DataType,
  testValue?: string | number | null,
): ReferenceNode {
  return new ReferenceNode(id, name, referenceType, dataType, testValue);
}

export function $isReferenceNode(
  node: LexicalNode | null | undefined,
): node is ReferenceNode {
  return node instanceof ReferenceNode;
}
