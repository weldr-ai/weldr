import { createId } from "@paralleldrive/cuid2";
import type {
  FlatInputSchema,
  InputSchema,
  JsonSchema,
  VarType,
} from "@specly/shared/types";
import type { TreeDataItem } from "@specly/ui/tree-view";
import {
  BanIcon,
  BinaryIcon,
  BracesIcon,
  BracketsIcon,
  HashIcon,
  TextIcon,
} from "lucide-react";

export function getVarTypeIcon(type: VarType) {
  switch (type) {
    case "string":
      return TextIcon;
    case "number":
      return HashIcon;
    case "integer":
      return HashIcon;
    case "boolean":
      return BinaryIcon;
    case "array":
      return BracketsIcon;
    case "object":
      return BracesIcon;
    case "null":
      return BanIcon;
    default:
      return HashIcon;
  }
}

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
      icon: getVarTypeIcon(inputSchema.type ?? "null"),
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

  if (path === "") {
    result.push({
      path,
      type: schema.type,
      required,
      description: schema.description,
    });
  }

  switch (schema.type) {
    case "object":
      if (schema.properties) {
        const requiredProperties = schema.required || [];
        for (const [key, value] of Object.entries(schema.properties)) {
          const isRequired = requiredProperties.includes(key);
          const newPath = path ? `${path}.${key}` : key;
          result.push(...flattenInputSchema(value, newPath, isRequired));
        }
      }
      break;

    case "array":
      if (schema.items) {
        const itemsPath = `${path}[]`;
        result.push(...flattenInputSchema(schema.items, itemsPath, false));
      }
      break;

    default:
      break;
  }

  return result;
}
