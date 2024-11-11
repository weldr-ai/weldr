import type {
  FlatInputSchema,
  JsonSchema,
  MessageRawContent,
} from "@integramind/shared/types";
import { getDataTypeIcon, toCamelCase } from "@integramind/shared/utils";
import type { TreeDataItem } from "@integramind/ui/tree-view";
import { createId } from "@paralleldrive/cuid2";

export function jsonSchemaToTreeData(
  schema: JsonSchema | undefined = undefined,
): TreeDataItem[] {
  if (!schema) {
    return [];
  }

  function jsonSchemaToTree(schema: JsonSchema, name = "root"): TreeDataItem {
    const treeItem: TreeDataItem = {
      id: createId(),
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
        id: createId(),
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

export function flattenInputSchema(
  schema: JsonSchema,
  path = "",
  required = false,
  refPath = "",
  expandArrays = true,
): FlatInputSchema[] {
  let tempPath = path;
  const result: FlatInputSchema[] = [];

  // Add the schema itself as an input if it has a title
  if (schema.title) {
    result.push({
      path: schema.title,
      type: schema.type ?? "null",
      required,
      description: schema.description,
      refUri: refPath,
    });
    // Update path to include the title for nested properties
    tempPath = schema.title;
  }

  if (schema.type === "object" && schema.properties) {
    const requiredProperties = schema.required || [];
    for (const [key, value] of Object.entries(schema.properties)) {
      const isRequired = requiredProperties.includes(key);
      const newPath = tempPath ? `${tempPath}.${key}` : key;
      const newRefPath = refPath
        ? `${refPath}/properties/${key}`
        : `${schema.$id ?? ""}/properties/${key}`;
      result.push({
        path: newPath,
        type: value.type ?? "null",
        required: isRequired,
        description: value.description,
        refUri: newRefPath,
      });
      if (value.type === "object" || (value.type === "array" && expandArrays)) {
        result.push(
          ...flattenInputSchema(
            value,
            newPath,
            isRequired,
            newRefPath,
            expandArrays,
          ),
        );
      }
    }
  } else if (schema.type === "array" && schema.items && expandArrays) {
    const itemsPath = `${tempPath}${schema.items.title ? schema.items.title : "items"}[]`;
    const itemsRefPath = `${refPath}/items`;
    result.push({
      path: itemsPath,
      type: schema.items.type ?? "null",
      required: false,
      description: schema.items.description,
      refUri: itemsRefPath,
    });
    if (schema.items.type === "object" || schema.items.type === "array") {
      result.push(
        ...flattenInputSchema(
          schema.items,
          itemsPath,
          false,
          itemsRefPath,
          expandArrays,
        ),
      );
    }
  } else if (!schema.title) {
    // Only add non-titled primitive schemas here since titled ones are added above
    result.push({
      path: tempPath,
      type: schema.type ?? "null",
      required,
      description: schema.description,
      refUri: refPath,
    });
  }

  return result;
}

export function rawMessageContentToText(
  rawMessageContent: MessageRawContent = [],
): string {
  function formatColumns(
    columns: { name: string; dataType: string }[],
  ): string {
    return columns
      .map((column) => `${column.name} (${column.dataType})`)
      .join(", ");
  }

  return rawMessageContent
    .map((element) => {
      if (element.type === "text") {
        return element.value;
      }

      if (element.type === "reference") {
        switch (element.referenceType) {
          case "input":
            return `input ${toCamelCase(element.name)} (${element.dataType})${
              "refUri" in element && element.refUri
                ? `, $ref: ${element.refUri}`
                : ""
            }`;
          case "database":
            return `database ${element.name} (ID: ${element.id})${
              "utils" in element && element.utils
                ? `, with utilities: ${element.utils
                    .map(
                      (util) =>
                        `name: ${util.name} (ID: ${util.id}), description: ${util.description}`,
                    )
                    .join(", ")}`
                : ""
            }`;
          case "database-table":
            return `table ${element.name}${
              "columns" in element && element?.columns
                ? `, with columns: ${formatColumns(element.columns ?? [])}`
                : ""
            }${
              "relationships" in element && element?.relationships
                ? `, with relationships: ${element?.relationships
                    ?.map(
                      (relationship) =>
                        `column: ${relationship.columnName} -> table: ${relationship.referencedTable}, column: ${relationship.referencedColumn}`,
                    )
                    .join(", ")}`
                : ""
            }${
              "database" in element && element?.database
                ? ` in database ${element?.database.name} (ID: ${element?.database.id}), with utilities: ${element?.database?.utils
                    .map(
                      (util) =>
                        `name: ${util.name} (ID: ${util.id}), description: ${util.description}`,
                    )
                    .join(", ")}`
                : ""
            }`;
          case "database-column":
            return `column ${element.name} (${element.dataType})${
              "table" in element && element?.table
                ? ` in table ${element?.table.name}`
                : ""
            }${
              "database" in element && element?.database
                ? ` in database ${element?.database.name} (ID: ${element?.database.id}), with utilities: ${element?.database?.utils
                    .map(
                      (util) =>
                        `name: ${util.name} (ID: ${util.id}), description: ${util.description}`,
                    )
                    .join(", ")}`
                : ""
            }`;
          default:
            return "";
        }
      }
    })
    .join("");
}
