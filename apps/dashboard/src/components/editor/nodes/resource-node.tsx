/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

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
import { Database } from "lucide-react";

export type SerializedResourceNode = Spread<
  {
    id: string;
    name: string;
  },
  SerializedLexicalNode
>;

function ResourceNodeComponent({ name }: { name: string }) {
  return (
    <div className="inline-flex items-center rounded-md border bg-accent px-1.5 py-0.5 text-xs text-accent-foreground">
      <Database className="mr-1 size-3 text-primary" />
      {name}
    </div>
  );
}

export class ResourceNode extends DecoratorNode<ReactNode> {
  __id: string;
  __name: string;

  constructor(id: string, name: string) {
    super();
    this.__id = id;
    this.__name = name;
  }

  static getType(): string {
    return "resource";
  }

  static clone(node: ResourceNode): ResourceNode {
    return new ResourceNode(node.__id, node.__name);
  }

  static importJSON(serializedNode: SerializedResourceNode): ResourceNode {
    const node = $createResourceNode(serializedNode.id, serializedNode.name);
    return node;
  }

  exportJSON(): SerializedResourceNode {
    return {
      id: this.__id,
      name: this.__name,
      type: "resource",
      version: 1,
    };
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("span");
    element.setAttribute("data-lexical-resource", "true");
    return { element };
  }

  createDOM(_config: EditorConfig, _editor: LexicalEditor): HTMLElement {
    const dom = document.createElement("span");
    dom.setAttribute("data-lexical-resource", "true");
    return dom;
  }

  updateDOM(): false {
    return false;
  }

  decorate(): JSX.Element {
    return <ResourceNodeComponent name={this.__name} />;
  }
}

export function $createResourceNode(id: string, name: string): ResourceNode {
  return new ResourceNode(id, name);
}

export function $isResourceNode(
  node: LexicalNode | null | undefined,
): node is ResourceNode {
  return node instanceof ResourceNode;
}
