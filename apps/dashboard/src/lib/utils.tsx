import { createId } from "@paralleldrive/cuid2";
import type { Input, JsonSchema, VarType } from "@specly/shared/types";
import type { TreeDataItem } from "@specly/ui/tree-view";
import {
  BanIcon,
  BinaryIcon,
  BracesIcon,
  BracketsIcon,
  HashIcon,
  TextIcon,
} from "lucide-react";

export function inputSchemaToTree(input: Input): TreeDataItem[] {
  const treeData: TreeDataItem[] = [];
  console.log(input);

  function getIcon(type: VarType) {
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

  function traverse(schema: Record<string, JsonSchema>, parentId: string) {
    for (const [key, value] of Object.entries(schema)) {
      const id = createId();

      treeData.push({
        id,
        name: key,
        type: value.type ?? "null",
        icon: getIcon(value.type ?? "null"),
      });

      if (value.type === "object" && value.properties) {
        traverse(value.properties, id);
      }
    }
  }

  traverse(input.properties || {}, createId());
  return treeData;
}
