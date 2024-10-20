import { createId } from "@paralleldrive/cuid2";
import type {
  FlatInputSchema,
  InputSchema,
  JsonSchema,
  RawDescription,
} from "@specly/shared/types";
import { getDataTypeIcon } from "@specly/shared/utils";
import type { TreeDataItem } from "@specly/ui/tree-view";

export function inputSchemaToTreeData(
  inputSchema: InputSchema | undefined,
): TreeDataItem[] {
  if (!inputSchema) {
    return [];
  }

  function inputSchemaToTree(
    inputSchema: InputSchema,
    name = "root",
  ): TreeDataItem {
    const treeItem: TreeDataItem = {
      id: createId(),
      name,
      type: inputSchema.type ?? "null",
      icon: getDataTypeIcon(inputSchema.type ?? "null"),
    };

    if (inputSchema.type === "object" && inputSchema.properties) {
      treeItem.children = Object.entries(inputSchema.properties).map(
        ([key, value]) => inputSchemaToTree(value, key),
      );
    } else if (inputSchema.type === "array" && inputSchema.items) {
      treeItem.children = [inputSchemaToTree(inputSchema.items, "items")];
    }

    return treeItem;
  }

  return inputSchemaToTree(inputSchema).children ?? [];
}

export function flattenInputSchema(
  schema: JsonSchema,
  path = "",
  required = false,
): FlatInputSchema[] {
  const result: FlatInputSchema[] = [];

  if (schema.type === "object" && schema.properties) {
    const requiredProperties = schema.required || [];
    for (const [key, value] of Object.entries(schema.properties)) {
      const isRequired = requiredProperties.includes(key);
      const newPath = path ? `${path}.${key}` : key;
      result.push({
        path: newPath,
        type: value.type,
        required: isRequired,
        description: value.description,
      });
      if (value.type === "object" || value.type === "array") {
        result.push(...flattenInputSchema(value, newPath, isRequired));
      }
    }
  } else if (schema.type === "array" && schema.items) {
    const itemsPath = `${path}[]`;
    result.push({
      path: itemsPath,
      type: schema.items.type,
      required: false,
      description: schema.items.description,
    });
    if (schema.items.type === "object" || schema.items.type === "array") {
      result.push(...flattenInputSchema(schema.items, itemsPath, false));
    }
  } else {
    result.push({
      path,
      type: schema.type,
      required,
      description: schema.description,
    });
  }

  return result;
}

export function fromRawDescriptionToText(
  rawDescription: RawDescription[],
): string {
  return rawDescription
    .map((element) => {
      if (element.type === "text") {
        return element.value;
      }

      if (element.type === "reference") {
        switch (element.referenceType) {
          case "database-table":
            return `table '${element.name}'`;
          case "database":
            return `postgres database '${element.name}' - its id is '${element.id}'`;
          case "database-column":
            return `column '${element.name}' of type '${element.dataType}'`;
          case "input":
            return `input '${element.name}' of type '${element.dataType}'`;
        }
      }
    })
    .join("");
}
