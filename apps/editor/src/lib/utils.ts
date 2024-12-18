import type { DatabaseStructure } from "@integramind/shared/integrations/postgres/index";
import type {
  AssistantMessageRawContent,
  JsonSchema,
} from "@integramind/shared/types";
import { getDataTypeIcon } from "@integramind/shared/utils";
import type { userMessageRawContentReferenceElementSchema } from "@integramind/shared/validators/conversations";
import type { TreeDataItem } from "@integramind/ui/tree-view";
import type { z } from "zod";

export function jsonSchemaToTreeData(
  schema: JsonSchema | undefined = undefined,
): TreeDataItem[] {
  if (!schema) {
    return [];
  }

  function jsonSchemaToTree(schema: JsonSchema, name = "root"): TreeDataItem {
    const treeItem: TreeDataItem = {
      id: `${name}`,
      name,
      type: schema.type ?? "null",
      icon: getDataTypeIcon(schema.type ?? "null"),
    };

    if (schema.type === "object" && schema.properties) {
      treeItem.children = Object.entries(schema.properties).map(
        ([key, value]) => jsonSchemaToTree(value, key),
      );
    } else if (schema.type === "array" && schema.items) {
      const arrayItem: TreeDataItem = {
        id: `${name}-items`,
        name: schema.title ?? "items",
        type: "array",
        icon: getDataTypeIcon("array"),
        children: [jsonSchemaToTree(schema.items, schema.title ?? "item")],
      };
      treeItem.children = [arrayItem];
    }

    return treeItem;
  }

  return jsonSchemaToTree(schema).children ?? [];
}

export function assistantMessageRawContentToText(
  rawMessageContent: AssistantMessageRawContent = [],
): string {
  return rawMessageContent
    .map((element) => {
      switch (element.type) {
        case "text": {
          return element.value;
        }
        case "reference": {
          return element.name;
        }
      }
    })
    .join("");
}

export function getResourceReferences(
  resources: {
    id: string;
    name: string;
    integrationType: "postgres" | "mysql";
    metadata?: unknown;
  }[],
): z.infer<typeof userMessageRawContentReferenceElementSchema>[] {
  const references: z.infer<
    typeof userMessageRawContentReferenceElementSchema
  >[] = [];

  for (const resource of resources ?? []) {
    references.push({
      id: resource.id,
      type: "reference",
      name: resource.name,
      referenceType: "database",
      databaseType: resource.integrationType,
    });

    if (
      resource.integrationType === "postgres" ||
      resource.integrationType === "mysql"
    ) {
      const databaseStructure = resource.metadata as DatabaseStructure;

      for (const table of databaseStructure) {
        for (const column of table.columns) {
          references.push({
            type: "reference",
            name: `${resource.name}.${table.name}.${column.name}`,
            referenceType: "database-column",
            dataType: column.dataType,
            databaseId: resource.id,
            tableName: table.name,
          });
        }

        references.push({
          type: "reference",
          name: `${resource.name}.${table.name}`,
          referenceType: "database-table",
          databaseId: resource.id,
        });
      }
    }
  }

  return references;
}
