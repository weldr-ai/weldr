import type { JsonSchema } from "@integramind/shared/types";
import type { JSONSchema7Definition } from "json-schema";

export function isJsonSchema(
  schema: JSONSchema7Definition,
): schema is JsonSchema {
  return (
    typeof schema === "object" && schema !== null && !Array.isArray(schema)
  );
}

export function hasProperties(schema: JsonSchema): schema is JsonSchema & {
  properties: Record<string, JSONSchema7Definition>;
} {
  return schema.properties !== undefined;
}

export function isValidSchemaItems(items: unknown): items is JsonSchema {
  return (
    typeof items === "object" &&
    items !== null &&
    !Array.isArray(items) &&
    "type" in items
  );
}
