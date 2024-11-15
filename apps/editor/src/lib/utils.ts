import type {
  FlatInputSchema,
  JsonSchema,
  MessageRawContent,
} from "@integramind/shared/types";
import { getDataTypeIcon, toCamelCase } from "@integramind/shared/utils";
import type { TreeDataItem } from "@integramind/ui/tree-view";

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
          case "variable":
            return `variable ${toCamelCase(element.name)} (${element.dataType})${
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
