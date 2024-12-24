import {
  BanIcon,
  BinaryIcon,
  BracesIcon,
  BracketsIcon,
  HashIcon,
  TextIcon,
} from "lucide-react";
import type { DataType } from "./types";

type NestedObject = {
  [key: string]: string | number | boolean | NestedObject;
};

export function formDataToStructuredObject(
  obj: Record<string, string>,
): NestedObject {
  const result: NestedObject = {};

  for (const [key, value] of Object.entries(obj)) {
    if (key.includes(".")) {
      const keys = key.split(".");
      let current: NestedObject = result;

      keys.forEach((k, index) => {
        if (index === keys.length - 1) {
          current[k] = value;
        } else {
          current[k] = (current[k] as NestedObject) || {};
          current = current[k] as NestedObject;
        }
      });
    } else {
      result[key] = value;
    }
  }

  return result;
}

export function pascalToKebabCase(str: string): string {
  return str
    .replace(/([A-Z])/g, (match, p1, offset) =>
      offset > 0 ? `-${p1.toLowerCase()}` : p1.toLowerCase(),
    )
    .toLowerCase();
}

export function getDataTypeIcon(type: DataType) {
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

export function renderDataTypeIcon(type: DataType) {
  const Icon = getDataTypeIcon(type);
  return <Icon className="mr-2 size-4 shrink-0 text-primary" />;
}
