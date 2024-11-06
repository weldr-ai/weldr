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

import { toCamelCase } from "@specly/shared/utils";
import type { userMessageRawContentReferenceElementSchema } from "@specly/shared/validators/conversations";
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

  formatColumns(columns: { name: string; dataType: string }[]): string {
    return columns
      .map((column) => `${column.name} (${column.dataType})`)
      .join(", ");
  }

  getTextContent(): string {
    switch (this.__reference.referenceType) {
      case "input":
        return `input ${toCamelCase(this.__reference.name)} (${this.__reference.dataType}), $ref: ${this.__reference.refUri}, required: ${this.__reference.required}`;
      case "database":
        return `database ${this.__reference.name} (ID: ${this.__reference.id}), with utilities: ${this.__reference.utils
          .map(
            (util) =>
              `name: ${util.name} (ID: ${util.id}), description: ${util.description}`,
          )
          .join(", ")}`;
      case "database-table":
        return `table ${this.__reference.name}, with columns: ${this.formatColumns(
          this.__reference.columns ?? [],
        )}${
          this.__reference.relationships.length > 0
            ? `, with relationships: ${this.__reference.relationships
                .map(
                  (relationship) =>
                    `column: ${relationship.columnName} -> table: ${relationship.referencedTable}, column: ${relationship.referencedColumn}`,
                )
                .join(", ")}`
            : ""
        }, in database ${this.__reference?.database?.name} (ID: ${this.__reference?.database?.id}), with utilities: ${this.__reference?.database?.utils
          .map(
            (util) =>
              `name: ${util.name} (ID: ${util.id}), description: ${util.description}`,
          )
          .join(", ")}`;
      case "database-column":
        return `column ${this.__reference.name} (${this.__reference.dataType}) in table ${this.__reference.table.name} in database ${this.__reference?.database?.name} (ID: ${this.__reference?.database?.id}), with utilities: ${this.__reference?.database?.utils
          .map(
            (util) =>
              `name: ${util.name} (ID: ${util.id}), description: ${util.description}`,
          )
          .join(", ")}`;
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
