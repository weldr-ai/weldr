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
import { DatabaseIcon } from "lucide-react";

import { PostgreSQLIcon } from "~/components/icons/postgresql-icon";

export type SerializedDataResourceNode = Spread<
  {
    id: string;
    name: string;
    icon: string;
  },
  SerializedLexicalNode
>;

function DataResourceNodeComponent({
  name,
  icon,
}: {
  name: string;
  icon: string;
}) {
  return (
    <div className="inline-flex items-center rounded-md border bg-accent px-1.5 py-0.5 text-xs text-accent-foreground">
      {icon === "postgresql-icon" ? (
        <PostgreSQLIcon className="mr-1 size-3 text-primary" />
      ) : (
        <DatabaseIcon className="mr-1 size-3 text-primary" />
      )}
      {name}
    </div>
  );
}

export class DataResourceNode extends DecoratorNode<ReactNode> {
  __id: string;
  __name: string;
  __icon: string;

  constructor(id: string, name: string, icon: string) {
    super();
    this.__id = id;
    this.__name = name;
    this.__icon = icon;
  }

  static getType(): string {
    return "data-resource";
  }

  static clone(node: DataResourceNode): DataResourceNode {
    return new DataResourceNode(node.__id, node.__name, node.__icon);
  }

  static importJSON(
    serializedNode: SerializedDataResourceNode,
  ): DataResourceNode {
    const node = $createDataResourceNode(
      serializedNode.id,
      serializedNode.name,
      serializedNode.icon,
    );
    return node;
  }

  exportJSON(): SerializedDataResourceNode {
    return {
      id: this.__id,
      name: this.__name,
      type: "data-resource",
      icon: this.__icon,
      version: 1,
    };
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("span");
    element.setAttribute("data-lexical-data-resource", "true");
    return { element };
  }

  createDOM(_config: EditorConfig, _editor: LexicalEditor): HTMLElement {
    const dom = document.createElement("span");
    dom.setAttribute("data-lexical-data-resource", "true");
    return dom;
  }

  updateDOM(): false {
    return false;
  }

  decorate(): JSX.Element {
    return <DataResourceNodeComponent name={this.__name} icon={this.__icon} />;
  }
}

export function $createDataResourceNode(
  id: string,
  name: string,
  icon: string,
): DataResourceNode {
  return new DataResourceNode(id, name, icon);
}

export function $isDataResourceNode(
  node: LexicalNode | null | undefined,
): node is DataResourceNode {
  return node instanceof DataResourceNode;
}
