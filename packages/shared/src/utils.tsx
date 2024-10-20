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

export function toCamelCase(str: string): string {
  const trimmedStr = str.trim();

  if (isCamelCase(trimmedStr)) {
    return trimmedStr;
  }

  return trimmedStr
    .toLowerCase()
    .split(/[\s-_]+/)
    .map((word, index) =>
      index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join("");
}

function isCamelCase(str: string): boolean {
  return /^[a-z][a-zA-Z]*$/.test(str);
}

export function toSnakeCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/\s+/g, "_");
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
  return <Icon className="size-4 shrink-0 mr-2 text-primary" />;
}

export function pgTypeToJsonSchemaType(pgType: string): DataType {
  // Normalize the input
  let normalizedPgType = pgType.trim().toLowerCase();

  // Handle array types
  if (normalizedPgType.endsWith("[]")) {
    return "array";
  }

  // Remove parameters, e.g., (255)
  normalizedPgType = pgType.replace(/\(.*\)/, "").trim();

  // Define the mapping from PostgreSQL types to JSON Schema types
  const typeMapping: { [key: string]: DataType } = {
    smallint: "integer",
    integer: "integer",
    int: "integer",
    bigint: "integer",
    serial: "integer",
    bigserial: "integer",
    decimal: "number",
    numeric: "number",
    real: "number",
    "double precision": "number",
    boolean: "boolean",
    bool: "boolean",
    "character varying": "string",
    varchar: "string",
    character: "string",
    char: "string",
    text: "string",
    date: "string",
    time: "string",
    "time without time zone": "string",
    timestamp: "string",
    "timestamp without time zone": "string",
    "timestamp with time zone": "string",
    json: "object",
    jsonb: "object",
    uuid: "string",
    bytea: "string",
    inet: "string",
    cidr: "string",
    macaddr: "string",
    xml: "string",
    tsvector: "string",
    tsquery: "string",
    hstore: "object",
  };

  return typeMapping[normalizedPgType] ?? "null";
}
