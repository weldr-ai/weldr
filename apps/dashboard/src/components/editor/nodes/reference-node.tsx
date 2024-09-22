import type {
  DOMExportOutput,
  EditorConfig,
  LexicalEditor,
  LexicalNode,
  SerializedLexicalNode,
  Spread,
} from "lexical";
import { DecoratorNode } from "lexical";
import {
  ColumnsIcon,
  HashIcon,
  TableIcon,
  TextIcon,
  VariableIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import type { VarType } from "@specly/shared/types";
import { toCamelCase } from "@specly/shared/utils";
import { PostgresIcon } from "@specly/ui/icons/postgres-icon";

export type SerializedReferenceNode = Spread<
  {
    id: string;
    name: string;
    referenceType: "input" | "database" | "database-table" | "database-column";
    icon:
      | "database-icon"
      | "number-icon"
      | "text-icon"
      | "value-icon"
      | "database-column-icon"
      | "database-table-icon";
    dataType?: VarType;
    testValue?: string | number | null;
  },
  SerializedLexicalNode
>;

function ReferenceNodeComponent({
  name,
  icon,
}: {
  name: string;
  icon:
    | "database-icon"
    | "number-icon"
    | "text-icon"
    | "value-icon"
    | "database-column-icon"
    | "database-table-icon";
}) {
  return (
    <div className="inline-flex items-center rounded-md border bg-accent px-1.5 py-0.5 text-xs text-accent-foreground">
      {icon === "database-icon" ? (
        <PostgresIcon className="mr-1 size-3 text-primary" />
      ) : icon === "number-icon" ? (
        <HashIcon className="mr-1 size-3 text-primary" />
      ) : icon === "text-icon" ? (
        <TextIcon className="mr-1 size-3 text-primary" />
      ) : icon === "value-icon" ? (
        <VariableIcon className="mr-1 size-3 text-primary" />
      ) : icon === "database-column-icon" ? (
        <ColumnsIcon className="mr-1 size-3 text-primary" />
      ) : icon === "database-table-icon" ? (
        <TableIcon className="mr-1 size-3 text-primary" />
      ) : (
        <></>
      )}
      {name}
    </div>
  );
}

export class ReferenceNode extends DecoratorNode<ReactNode> {
  __id: string;
  __name: string;
  __referenceType: "input" | "database" | "database-table" | "database-column";
  __dataType?: VarType;
  __testValue?: string | number | null;
  __icon:
    | "database-icon"
    | "number-icon"
    | "text-icon"
    | "value-icon"
    | "database-column-icon"
    | "database-table-icon";

  constructor(
    id: string,
    name: string,
    referenceType: "input" | "database" | "database-table" | "database-column",
    icon:
      | "database-icon"
      | "number-icon"
      | "text-icon"
      | "value-icon"
      | "database-column-icon"
      | "database-table-icon",
    dataType?: VarType,
    testValue?: string | number | null,
  ) {
    super();
    this.__id = id;
    this.__name = name;
    this.__referenceType = referenceType;
    this.__dataType = dataType;
    this.__icon = icon;
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
      node.__icon,
      node.__dataType,
      node.__testValue,
    );
  }

  static importJSON(serializedNode: SerializedReferenceNode): ReferenceNode {
    const node = $createReferenceNode(
      serializedNode.id,
      serializedNode.name,
      serializedNode.referenceType,
      serializedNode.icon,
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
      icon: this.__icon,
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
    return <ReferenceNodeComponent name={this.__name} icon={this.__icon} />;
  }
}

export function $createReferenceNode(
  id: string,
  name: string,
  referenceType: "input" | "database" | "database-table" | "database-column",
  icon:
    | "database-icon"
    | "number-icon"
    | "text-icon"
    | "value-icon"
    | "database-column-icon"
    | "database-table-icon",
  dataType?: VarType,
  testValue?: string | number | null,
): ReferenceNode {
  return new ReferenceNode(id, name, referenceType, icon, dataType, testValue);
}

export function $isReferenceNode(
  node: LexicalNode | null | undefined,
): node is ReferenceNode {
  return node instanceof ReferenceNode;
}
