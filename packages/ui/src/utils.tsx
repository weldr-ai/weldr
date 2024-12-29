import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import {
  BanIcon,
  BinaryIcon,
  BracesIcon,
  BracketsIcon,
  HashIcon,
  TextIcon,
} from "lucide-react";
import { twMerge } from "tailwind-merge";

export type DataType =
  | "string"
  | "number"
  | "integer"
  | "array"
  | "boolean"
  | "object"
  | "null";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function getDataTypeIcon(type: DataType) {
  switch (type) {
    case "string":
      return TextIcon;
    case "number":
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
      return BracesIcon;
  }
}

export function renderDataTypeIcon(type: DataType) {
  const Icon = getDataTypeIcon(type);
  return <Icon className="mr-2 size-4 shrink-0 text-primary" />;
}
