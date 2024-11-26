import type {
  AssistantMessageRawContent,
  FlatInputSchema,
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
      id: `${schema.$id}-${name}`,
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
        id: `${schema.$id}-${name}-items`,
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

export function flattenInputSchema({
  schema,
  path = "",
  required = false,
  refPath = "",
  expandArrays = true,
  title,
}: {
  schema: JsonSchema;
  path?: string;
  required?: boolean;
  refPath?: string;
  expandArrays?: boolean;
  title?: string;
}): FlatInputSchema[] {
  let tempPath = path;
  const refUri = refPath ? `${refPath}` : `${schema.$id}`;
  const result: FlatInputSchema[] = [];

  // Add the schema itself as an input if it has a title
  if (schema.title || title) {
    const properties =
      schema.type === "object" && schema.properties
        ? Object.entries(schema.properties).reduce<Record<string, JsonSchema>>(
            (acc, [key, value]) => {
              acc[key] = value;
              return acc;
            },
            {},
          )
        : undefined;

    const itemsType =
      schema.type === "array" && schema.items ? schema.items : undefined;

    result.push({
      path: title ?? schema.title ?? "",
      type: schema.type ?? "null",
      required,
      description: schema.description,
      refUri,
      ...(properties && { properties }),
      ...(itemsType && { itemsType }),
    });
    // Update path to include the title for nested properties
    tempPath = title ?? schema.title ?? "";
  }

  if (schema.type === "object" && schema.properties) {
    const requiredProperties = schema.required || [];
    for (const [key, value] of Object.entries(schema.properties)) {
      const isRequired = requiredProperties.includes(key);
      const newPath = tempPath ? `${tempPath}.${key}` : key;
      const newRefPath = refPath
        ? `${refPath}/properties/${key}`
        : `${refUri}/properties/${key}`;

      const properties =
        value.type === "object" && value.properties
          ? Object.entries(value.properties).reduce<Record<string, JsonSchema>>(
              (acc, [k, v]) => {
                acc[k] = v;
                return acc;
              },
              {},
            )
          : undefined;

      const itemsType =
        value.type === "array" && value.items ? value.items : undefined;

      result.push({
        path: newPath,
        type: value.type ?? "null",
        required: isRequired,
        description: value.description,
        refUri: newRefPath,
        ...(properties && { properties }),
        ...(itemsType && { itemsType }),
      });

      if (value.type === "object" || (value.type === "array" && expandArrays)) {
        result.push(
          ...flattenInputSchema({
            schema: value,
            path: newPath,
            required: isRequired,
            refPath: newRefPath,
            expandArrays,
          }),
        );
      }
    }
  } else if (schema.type === "array" && schema.items && expandArrays) {
    const itemsPath = `${schema.title ? schema.title : "items"}[]`;
    const itemsRefPath = refPath ? `${refPath}/items` : `${refUri}/items`;

    const properties =
      schema.items.type === "object" && schema.items.properties
        ? Object.entries(schema.items.properties).reduce<
            Record<string, JsonSchema>
          >((acc, [key, value]) => {
            acc[key] = value;
            return acc;
          }, {})
        : undefined;

    const itemsType =
      schema.items.type === "array" && schema.items.items
        ? schema.items.items
        : undefined;

    result.push({
      path: itemsPath,
      type: schema.items.type ?? "null",
      required: false,
      description: schema.items.description,
      refUri: itemsRefPath,
      ...(properties && { properties }),
      ...(itemsType && { itemsType }),
    });

    if (schema.items.type === "object" || schema.items.type === "array") {
      result.push(
        ...flattenInputSchema({
          schema: schema.items,
          path: itemsPath,
          required: false,
          refPath: itemsRefPath,
          expandArrays,
        }),
      );
    }
  } else if (!schema.title) {
    // Only add non-titled primitive schemas here since titled ones are added above
    result.push({
      path: tempPath,
      type: schema.type ?? "null",
      required,
      description: schema.description,
      refUri,
    });
  }

  return result;
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
    case "variable": {
      const parts = [
        `Value of the input variable \`${reference.name}\``,
        `Type: ${reference.dataType}`,
        reference.refUri ? `$ref: ${reference.refUri}` : null,
        `Required: ${reference.required}`,
      ].filter(Boolean);

      const formatObjectProps = (props: JsonSchema["properties"]): string => {
        if (!props) return "";
        return Object.entries(props)
          .map(
            ([name, prop]) =>
              `- ${name}:\n` +
              `  - Type: ${prop.type}\n` +
              `  - Required: ${prop.required ?? false}`,
          )
          .join("\n");
      };

      const formatArrayItemsType = (itemsType: JsonSchema["items"]): string => {
        if (typeof itemsType === "object") {
          return `Properties:\n${formatObjectProps(itemsType.properties)}`;
        }
        return String(itemsType);
      };

      let details = "";

      switch (reference.dataType) {
        case "object": {
          details = `\nProperties:\n${formatObjectProps(reference.properties)}`;
          break;
        }
        case "array": {
          if (reference.itemsType) {
            details = `\nItems:\n${formatArrayItemsType(reference.itemsType)}`;
          }
          break;
        }
      }

      return `${parts.join("\n")}${details}`;
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
      case "variable": {
        return `var-${element.name}-${element.dataType}`;
      }
      case "database":
        return `db-${element.id}`;
      case "database-table":
        return `db-table-${element.name}-${element.database.id}`;
      case "database-column":
        return `db-col-${element.name}-${element.database.id}-${element.table.name}`;
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
