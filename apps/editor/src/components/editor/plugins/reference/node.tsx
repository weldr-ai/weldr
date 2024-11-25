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

import type { userMessageRawContentReferenceElementSchema } from "@integramind/shared/validators/conversations";
import type { z } from "zod";
import { ReferenceBadge } from "~/components/editor/reference-badge";

export type SerializedReferenceNode = Spread<
  z.infer<typeof userMessageRawContentReferenceElementSchema>,
  SerializedLexicalNode
>;

export class ReferenceNode extends DecoratorNode<ReactNode> {
  __reference: z.infer<typeof userMessageRawContentReferenceElementSchema>;

  constructor(
    reference: z.infer<typeof userMessageRawContentReferenceElementSchema>,
  ) {
    super();
    this.__reference = reference;
  }

  static getType(): string {
    return "reference";
  }

  static clone(node: ReferenceNode): ReferenceNode {
    return new ReferenceNode(node.exportJSON());
  }

  static importJSON(serializedNode: SerializedReferenceNode): ReferenceNode {
    const node = $createReferenceNode(serializedNode);
    return node;
  }

  exportJSON(): SerializedReferenceNode {
    return {
      type: "reference" as const,
      version: 1,
      ...Object.fromEntries(
        Object.entries(this.__reference).filter(([key]) => key !== "type"),
      ),
    } as SerializedReferenceNode;
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("span");
    element.setAttribute("data-lexical-reference", "true");
    return { element };
  }

  getTextContent(): string {
    return this.__reference.name;
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
    return <ReferenceBadge reference={this.__reference} />;
  }
}

export function $createReferenceNode(
  referenceNode: z.infer<typeof userMessageRawContentReferenceElementSchema>,
): ReferenceNode {
  return new ReferenceNode(referenceNode);
}

export function $isReferenceNode(
  node: LexicalNode | null | undefined,
): node is ReferenceNode {
  return node instanceof ReferenceNode;
}
