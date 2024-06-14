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
import { DatabaseIcon, VariableIcon } from "lucide-react";

export type SerializedValueNode = Spread<
  {
    id: string;
    name: string;
    icon: string;
  },
  SerializedLexicalNode
>;

function ValueNodeComponent({ name, icon }: { name: string; icon: string }) {
  return (
    <div className="inline-flex items-center rounded-md border bg-accent px-1.5 py-0.5 text-xs text-accent-foreground">
      {icon === "database-icon" ? (
        <DatabaseIcon className="mr-1 size-3 text-primary" />
      ) : (
        <VariableIcon className="mr-1 size-3 text-primary" />
      )}
      {name}
    </div>
  );
}

export class ValueNode extends DecoratorNode<ReactNode> {
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
    return "value";
  }

  static clone(node: ValueNode): ValueNode {
    return new ValueNode(node.__id, node.__name, node.__icon);
  }

  static importJSON(serializedNode: SerializedValueNode): ValueNode {
    const node = $createValueNode(
      serializedNode.id,
      serializedNode.name,
      serializedNode.icon,
    );
    return node;
  }

  exportJSON(): SerializedValueNode {
    return {
      id: this.__id,
      name: this.__name,
      type: "value",
      icon: this.__icon,
      version: 1,
    };
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("span");
    element.setAttribute("data-lexical-value", "true");
    return { element };
  }

  createDOM(_config: EditorConfig, _editor: LexicalEditor): HTMLElement {
    const dom = document.createElement("span");
    dom.setAttribute("data-lexical-value", "true");
    return dom;
  }

  updateDOM(): false {
    return false;
  }

  decorate(): JSX.Element {
    return <ValueNodeComponent name={this.__name} icon={this.__icon} />;
  }
}

export function $createValueNode(
  id: string,
  name: string,
  icon: string,
): ValueNode {
  return new ValueNode(id, name, icon);
}

export function $isValueNode(
  node: LexicalNode | null | undefined,
): node is ValueNode {
  return node instanceof ValueNode;
}
