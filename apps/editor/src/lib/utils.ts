import type { RouterOutputs } from "@integramind/api";
import type { DatabaseStructure } from "@integramind/shared/integrations/postgres/index";
import type {
  AssistantMessageRawContent,
  JsonSchema,
  UserMessageRawContent,
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
      id: name,
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

function referenceToText(
  reference: z.infer<typeof userMessageRawContentReferenceElementSchema>,
  seenElements: Map<string, boolean>,
): string {
  switch (reference.referenceType) {
    case "primitive": {
      return [
        `Function \`${reference.name}\` (ID: ${reference.id})`,
        "Input Schema:",
        reference.inputSchema,
        "Output Schema:",
        reference.outputSchema,
        "Description:",
        reference.description,
        "Logical Steps:",
        reference.logicalSteps,
        "Edge Cases:",
        reference.edgeCases,
        "Error Handling:",
        reference.errorHandling,
      ].join("\n");
    }

    case "database": {
      return [
        `Database \`${reference.name}\` (ID: ${reference.id})`,
        "Utilities:",
        ...reference.utils.map(
          (util) =>
            `- \`${util.name}\` (ID: ${util.id})\n` +
            `  Description: ${util.description}`,
        ),
      ].join("\n");
    }

    case "database-table": {
      const parts = [
        `Table \`${reference.name}\``,
        "Columns:",
        ...(reference.columns?.map(
          (col) => `- \`${col.name}\` (${col.dataType})`,
        ) ?? []),
      ];

      if (reference.relationships.length > 0) {
        parts.push("Relationships:");
        parts.push(
          ...reference.relationships.map(
            (rel) =>
              `- \`${rel.columnName}\` -> \`${rel.referencedTable}\`.\`${rel.referencedColumn}\``,
          ),
        );
      }

      return parts.join("\n");
    }

    case "database-column": {
      const tableKey = `db-table-${reference.table.name}-${reference.database.id}`;
      if (seenElements.has(tableKey)) return "";
      seenElements.set(tableKey, true);

      const parts = [
        `Table \`${reference.table.name}\``,
        "Columns:",
        ...reference.table.columns.map(
          (col) => `- \`${col.name}\` (${col.dataType})`,
        ),
      ];

      if (reference.table.relationships.length > 0) {
        parts.push("Relationships:");
        parts.push(
          ...reference.table.relationships.map(
            (rel) =>
              `- \`${rel.columnName}\` -> \`${rel.referencedTable}\`.\`${rel.referencedColumn}\``,
          ),
        );
      }

      return parts.join("\n");
    }

    default: {
      return "";
    }
  }
}

export function userMessageRawContentToText(
  rawMessageContent: UserMessageRawContent = [],
): string | null {
  const context: string[] = [];
  const seenElements = new Map<string, boolean>();

  const getElementKey = (element: UserMessageRawContent[number]): string => {
    if (element.type === "text") return element.value;

    switch (element.referenceType) {
      case "primitive": {
        return `function-${element.id}`;
      }
      case "database": {
        return `db-${element.id}`;
      }
      case "database-table": {
        return `db-table-${element.name}-${element.database.id}`;
      }
      case "database-column": {
        return `db-col-${element.name}-${element.database.id}-${element.table.name}`;
      }
      default:
        return "";
    }
  };

  const text = rawMessageContent
    .reduce((acc, element) => {
      switch (element.type) {
        case "text": {
          return `${acc}${element.value}`;
        }

        case "reference": {
          const key = getElementKey(element);

          if (!seenElements.has(key)) {
            seenElements.set(key, true);

            // For database-related references, check if we need to add database info first
            if (
              element.referenceType === "database-table" ||
              element.referenceType === "database-column"
            ) {
              const dbKey = `db-${element.database.id}`;
              if (!seenElements.has(dbKey)) {
                seenElements.set(dbKey, true);
                const dbInfo = {
                  ...element.database,
                  type: "reference" as const,
                  referenceType: "database" as const,
                };
                context.push(referenceToText(dbInfo, seenElements));
              }
            }

            context.push(referenceToText(element, seenElements));
          }
          return `${acc}${element.name}`;
        }
      }
    }, "")
    .trim();

  return text.length > 0
    ? `${
        context.length > 0
          ? `## Context\n${context.filter(Boolean).join("\n\n")}\n\n`
          : ""
      }## Request\n${text}`
    : null;
}

export function getResourceReferences(
  resources: (RouterOutputs["workspaces"]["byId"]["resources"][0] & {
    metadata?: unknown;
  })[],
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
      utils:
        resource.integration.utils?.map((util) => ({
          id: util.id,
          name: util.name,
          description: util.description,
        })) ?? [],
    });

    if (
      resource.integration.type === "postgres" ||
      resource.integration.type === "mysql"
    ) {
      const databaseStructure = resource.metadata as DatabaseStructure;

      for (const table of databaseStructure) {
        for (const column of table.columns) {
          references.push({
            type: "reference",
            name: `${table.name}.${column.name}`,
            referenceType: "database-column",
            dataType: column.dataType,
            database: {
              id: resource.id,
              name: resource.name,
              utils:
                resource.integration.utils?.map((util) => ({
                  id: util.id,
                  name: util.name,
                  description: util.description,
                })) ?? [],
            },
            table: {
              name: table.name,
              columns: table.columns,
              relationships: table.relationships,
            },
          });
        }

        references.push({
          type: "reference",
          name: `${table.name}`,
          referenceType: "database-table",
          database: {
            id: resource.id,
            name: resource.name,
            utils:
              resource.integration.utils?.map((util) => ({
                id: util.id,
                name: util.name,
                description: util.description,
              })) ?? [],
          },
          columns: table.columns,
          relationships: table.relationships,
        });
      }
    }
  }

  return references;
}
