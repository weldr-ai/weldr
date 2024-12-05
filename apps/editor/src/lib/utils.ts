import type { RouterOutputs } from "@integramind/api";
import type { DatabaseStructure } from "@integramind/shared/integrations/postgres/index";
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

export function flattenInputSchema({
  id,
  schema,
  path = "",
  required = false,
  refPath = "",
  expandArrays = true,
  title,
  sourcePrimitiveId,
}: {
  id: string;
  schema?: JsonSchema;
  path?: string;
  required?: boolean;
  refPath?: string;
  expandArrays?: boolean;
  title?: string;
  sourcePrimitiveId?: string;
}): FlatInputSchema[] {
  if (!schema) {
    return [];
  }

  let tempPath = path;
  const refUri = schema.$ref ? schema.$ref : refPath ? `${refPath}` : `/${id}`;
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
      sourcePrimitiveId,
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
      const newRefPath = value.$ref
        ? value.$ref
        : refPath
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
        sourcePrimitiveId,
        ...(properties && { properties }),
        ...(itemsType && { itemsType }),
      });

      if (value.type === "object" || (value.type === "array" && expandArrays)) {
        result.push(
          ...flattenInputSchema({
            id,
            schema: value,
            path: newPath,
            required: isRequired,
            refPath: newRefPath,
            expandArrays,
            sourcePrimitiveId,
          }),
        );
      }
    }
  } else if (schema.type === "array" && schema.items && expandArrays) {
    const itemsPath = `${schema.title ? schema.title : "items"}[]`;
    const itemsRefPath = schema.items.$ref
      ? schema.items.$ref
      : refPath
        ? `${refPath}/items`
        : `${refUri}/items`;

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
      sourcePrimitiveId,
      ...(properties && { properties }),
      ...(itemsType && { itemsType }),
    });

    if (schema.items.type === "object" || schema.items.type === "array") {
      result.push(
        ...flattenInputSchema({
          id,
          schema: schema.items,
          path: itemsPath,
          required: false,
          refPath: itemsRefPath,
          expandArrays,
          sourcePrimitiveId,
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
      sourcePrimitiveId,
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
        `Is optional: ${!reference.required}`,
        reference.sourcePrimitiveId
          ? `Source function ID: ${reference.sourcePrimitiveId}`
          : null,
        reference.refUri ? `$ref: /schemas/${reference.refUri}` : null,
      ].filter(Boolean);

      const formatObjectProps = (props: JsonSchema["properties"]): string => {
        if (!props) return "";
        return Object.entries(props)
          .map(
            ([name, prop]) =>
              `- ${name}:\n` +
              `  - Type: ${prop.type}\n` +
              `  - Is optional: ${!prop.required}\n` +
              `  - $ref: /schemas/${reference.refUri}/properties/${name}`,
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

    case "function": {
      return [
        `Function \`${reference.name}\` (ID: ${reference.id})`,
        "Scope:",
        reference.scope === "local" ? "Local function" : "Imported function",
        ...(reference.inputSchema
          ? ["Input Schema:", reference.inputSchema]
          : []),
        ...(reference.outputSchema
          ? ["Output Schema:", reference.outputSchema]
          : []),
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
        ...(reference.utils.length > 0
          ? [
              "Utilities:",
              ...reference.utils.map(
                (util) =>
                  `- \`${util.name}\` (ID: ${util.id})\n` +
                  `  Description: ${util.description}`,
              ),
            ]
          : []),
      ].join("\n");
    }

    case "database-table": {
      const parts = [
        `Table \`${reference.name}\``,
        ...(reference.columns?.length > 0
          ? [
              "Columns:",
              ...reference.columns.map(
                (col) => `- \`${col.name}\` (${col.dataType})`,
              ),
            ]
          : []),
        ...(reference.relationships && reference.relationships.length > 0
          ? [
              "Relationships:",
              ...reference.relationships.map(
                (rel) =>
                  `- \`${rel.columnName}\` -> \`${rel.referencedTable}\`.\`${rel.referencedColumn}\``,
              ),
            ]
          : []),
      ];

      return parts.join("\n");
    }

    case "database-column": {
      const tableKey = `db-table-${reference.table.name}-${reference.database.id}`;
      if (seenElements.has(tableKey)) return "";
      seenElements.set(tableKey, true);

      const parts = [
        `Table \`${reference.table.name}\``,
        ...(reference.table.columns.length > 0
          ? [
              "Columns:",
              ...reference.table.columns.map(
                (col) => `- \`${col.name}\` (${col.dataType})`,
              ),
            ]
          : []),
        ...(reference.table.relationships &&
        reference.table.relationships.length > 0
          ? [
              "Relationships:",
              ...reference.table.relationships.map(
                (rel) =>
                  `- \`${rel.columnName}\` -> \`${rel.referencedTable}\`.\`${rel.referencedColumn}\``,
              ),
            ]
          : []),
      ];

      return parts.join("\n");
    }

    default: {
      return "";
    }
  }
}

export function userMessageRawContentToText(
  rawMessageContent: UserMessageRawContent = [],
  options: {
    includeDatabaseInfo: boolean;
  } = {
    includeDatabaseInfo: true,
  },
): string | null {
  const context: string[] = [];
  const seenElements = new Map<string, boolean>();

  const getElementKey = (element: UserMessageRawContent[number]): string => {
    if (element.type === "text") return element.value;

    switch (element.referenceType) {
      case "variable": {
        return `var-${element.name}-${element.dataType}`;
      }
      case "function": {
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
              if (!seenElements.has(dbKey) && options.includeDatabaseInfo) {
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
  notInclude: (
    | "database"
    | "database-table"
    | "database-column"
    | "function"
  )[] = [],
): z.infer<typeof userMessageRawContentReferenceElementSchema>[] {
  const references: z.infer<
    typeof userMessageRawContentReferenceElementSchema
  >[] = [];

  for (const resource of resources ?? []) {
    if (!notInclude.includes("database")) {
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
    }

    if (!notInclude.includes("database-table")) {
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

          if (!notInclude.includes("database-table")) {
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
    }
  }

  return references;
}
