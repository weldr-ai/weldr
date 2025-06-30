import { XMLParser } from "fast-xml-parser";
import pluralize from "pluralize";
import {
  ZodArray,
  ZodBoolean,
  ZodDefault,
  ZodDiscriminatedUnion,
  ZodEnum,
  ZodFirstPartyTypeKind,
  ZodLiteral,
  ZodNumber,
  ZodObject,
  ZodOptional,
  type ZodRawShape,
  ZodRecord,
  type ZodSchema,
  ZodString,
  ZodUnion,
  z,
} from "zod";

function getPropertyEntries<T extends ZodRawShape>(
  schema: ZodObject<T>,
): [string, ZodSchema][] {
  return Object.entries(schema.shape);
}

type UnknownXML = Record<string, unknown> | unknown[] | unknown | null;

function isXMLRecord(xml: UnknownXML): xml is Record<string, unknown> {
  return typeof xml === "object" && xml !== null;
}

function isXMLArray(xml: UnknownXML): xml is unknown[] {
  return Array.isArray(xml);
}

function isPrimitive(xml: UnknownXML): xml is string | number | boolean {
  return (
    typeof xml === "string" ||
    typeof xml === "number" ||
    typeof xml === "boolean"
  );
}

class UnparsedString extends ZodString {
  constructor() {
    super({
      checks: [],
      typeName: ZodFirstPartyTypeKind.ZodString,
      coerce: false,
    });
  }
}

export const createUnparsedString = () => new UnparsedString();

function getUnparsedStringNodeNames(
  schema: ZodSchema,
  path: string[] = [],
  acc: string[] = [],
): string[] {
  const newAcc = [...acc];

  // Handle wrapper types
  if (schema instanceof ZodOptional) {
    return getUnparsedStringNodeNames(schema.unwrap(), path, newAcc);
  }

  if (schema instanceof ZodDefault) {
    return getUnparsedStringNodeNames(schema.removeDefault(), path, newAcc);
  }

  // Handle union types - check all options
  if (schema instanceof ZodUnion) {
    for (const option of schema.options) {
      newAcc.push(...getUnparsedStringNodeNames(option, path, []));
    }
    return newAcc;
  }

  // Handle discriminated union types - check all options
  if (schema instanceof ZodDiscriminatedUnion) {
    for (const option of schema.options) {
      newAcc.push(...getUnparsedStringNodeNames(option, path, []));
    }
    return newAcc;
  }

  // Handle record types
  if (schema instanceof ZodRecord && schema.valueSchema) {
    return getUnparsedStringNodeNames(schema.valueSchema, path, newAcc);
  }

  if (schema instanceof ZodObject) {
    const entries = getPropertyEntries(schema);
    for (const [key, value] of entries) {
      if (value instanceof UnparsedString) {
        newAcc.push(path.concat([key]).join("."));
      } else if (value instanceof ZodObject) {
        newAcc.push(
          ...getUnparsedStringNodeNames(value, [...path, key], newAcc),
        );
      } else if (value instanceof ZodArray) {
        // What to do here?
        newAcc.push(
          ...getUnparsedStringNodeNames(value, [...path, key], newAcc),
        );
      } else {
        // Handle other wrapper types recursively
        newAcc.push(...getUnparsedStringNodeNames(value, [...path, key], []));
      }
    }
  } else if (schema instanceof ZodArray) {
    const recursionResult = getUnparsedStringNodeNames(
      schema.element,
      path,
      newAcc,
    );
    newAcc.push(...recursionResult);
  }
  return newAcc;
}

export class ZodXml<T extends ZodSchema> {
  zSchema: T;
  parser: XMLParser;

  constructor(zSchema: T) {
    this.zSchema = zSchema;
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "",
      parseAttributeValue: true,
      stopNodes: getUnparsedStringNodeNames(zSchema),
    });
  }

  fromXmlToZod(
    xml: UnknownXML,
    schema: ZodSchema,
    path: string[],
  ): z.infer<ZodSchema> {
    // Handle wrapper types first
    if (schema instanceof ZodOptional) {
      if (xml === null || xml === undefined) {
        return undefined;
      }
      return this.fromXmlToZod(xml, schema.unwrap(), path);
    }

    if (schema instanceof ZodDefault) {
      if (xml === null || xml === undefined) {
        return schema._def.defaultValue();
      }
      return this.fromXmlToZod(xml, schema.removeDefault(), path);
    }

    // Handle union types - try each option until one succeeds
    if (schema instanceof ZodUnion) {
      for (const option of schema.options) {
        try {
          return this.fromXmlToZod(xml, option, path);
        } catch {
          // Continue to next option
        }
      }
      // If none worked, let Zod handle the error
      return throwWithZodError(path, schema.safeParse(xml), xml);
    }

    // Handle discriminated unions - use discriminator to choose the right option
    if (schema instanceof ZodDiscriminatedUnion) {
      if (!isXMLRecord(xml)) {
        return throwWithZodError(path, schema.safeParse(xml), xml);
      }

      const discriminator = schema.discriminator;
      const discriminatorValue = xml[discriminator];

      // Find the option that matches the discriminator value
      for (const option of schema.options) {
        if (option instanceof ZodObject) {
          const entries = getPropertyEntries(option);
          const discField = entries.find(([key]) => key === discriminator);
          if (discField && discField[1] instanceof ZodLiteral) {
            if (discField[1].value === discriminatorValue) {
              return this.fromXmlToZod(xml, option, path);
            }
          }
        }
      }

      // If no matching option found, let Zod handle the error
      return throwWithZodError(path, schema.safeParse(xml), xml);
    }

    // Handle record types
    if (schema instanceof ZodRecord) {
      if (!isXMLRecord(xml)) {
        return throwWithZodError(path, schema.safeParse(xml), xml);
      }

      const result: Record<string, unknown> = {};
      const valueSchema = schema.valueSchema;

      if (valueSchema) {
        for (const [key, value] of Object.entries(xml)) {
          result[key] = this.fromXmlToZod(value, valueSchema, [...path, key]);
        }
      } else {
        // No value schema, just pass through
        for (const [key, value] of Object.entries(xml)) {
          result[key] = value;
        }
      }

      return throwWithZodError(path, schema.safeParse(result), result);
    }

    const isArrayRequested = schema instanceof ZodArray;

    if (isPrimitive(xml)) {
      if (isArrayRequested) {
        return throwWithZodError(path, schema.safeParse([xml]), xml);
      }
      return throwWithZodError(path, schema.safeParse(xml), xml);
    }

    if (isXMLArray(xml)) {
      if (isArrayRequested) {
        return throwWithZodError(path, schema.safeParse(xml), xml);
      }
      throw new XmlValidationError(
        path,
        new z.ZodError([
          {
            code: "custom",
            message:
              "Arrays were provided but a single primitive value was expected",
            path: [],
          },
        ]),
        xml,
      );
    }

    if (isXMLRecord(xml)) {
      if (isArrayRequested) {
        // Check if there's only one property which is an array
        const keys = Object.keys(xml);
        const firstKey = keys[0];
        if (!firstKey) {
          throw new XmlValidationError(
            path,
            new z.ZodError([
              {
                code: "custom",
                message: "XML object cannot be empty when array is expected",
                path: [],
              },
            ]),
            xml,
          );
        }
        const firstKeyValues = xml[firstKey];
        if (keys.length === 1 && Array.isArray(firstKeyValues)) {
          // For arrays, we need to determine if the array items should be wrapped or unwrapped
          // If the schema expects an array of objects directly, we should return the array items directly
          // If the schema expects an array of objects with the key name, we should wrap them

          // Check if this is a direct array (like users expecting user objects)
          // vs a wrapped array (like columns expecting column wrapper objects)
          const singularKey = getSingularKey(path[path.length - 1] || "item");

          if (firstKey === singularKey) {
            // This is a direct array - return the items without wrapping
            return throwWithZodError(
              path,
              schema.safeParse(firstKeyValues),
              firstKeyValues,
            );
          }

          // This is a wrapped array - wrap each item
          const transformed = firstKeyValues.map((item: unknown) => {
            const result: Record<string, unknown> = {};
            result[firstKey] = item;
            return result;
          });

          return throwWithZodError(
            path,
            schema.safeParse(transformed),
            transformed,
          );
        }

        // Case 2: Single key with object value - this is a single array element
        // This handles the case where XML parser creates {declarations: {declaration: {...}}}
        // but Zod expects {declarations: [{...}]}
        if (
          keys.length === 1 &&
          typeof firstKeyValues === "object" &&
          firstKeyValues !== null &&
          !Array.isArray(firstKeyValues)
        ) {
          // Extract the object content and put it in an array
          return throwWithZodError(path, schema.safeParse([firstKeyValues]), [
            firstKeyValues,
          ]);
        }

        // Case 3: Fallback - wrap the entire object in an array
        return throwWithZodError(path, schema.safeParse([xml]), [xml]);
      }

      if (schema instanceof ZodObject) {
        // Iterate through properties and recurse
        const entries = getPropertyEntries(schema);
        const result: Record<string, unknown> = {};
        for (const [key, value] of entries) {
          const xmlValue = xml[key];
          result[key] = this.fromXmlToZod(xmlValue, value, [...path, key]);
        }
        return result;
      }
    }

    return throwWithZodError(path, schema.safeParse(xml), xml);
  }

  parse(xml: string): z.infer<T> {
    const asJs = this.parser.parse(xml);
    return this.fromXmlToZod(asJs, this.zSchema, []);
  }

  /**
   * Returns a properly formatted XML structure description optimized for LLMs
   */
  describe(
    key = "",
    subSchema: ZodSchema = this.zSchema,
    nestingLevel = 0,
  ): string {
    const indent = "  ".repeat(nestingLevel);

    // Handle wrapper types first (optional, default)
    if (subSchema instanceof ZodOptional) {
      const innerSchema = subSchema.unwrap();

      if (key === "") {
        return `${getTypeLabel(subSchema)}`;
      }

      // Check if inner schema has a default
      if (innerSchema instanceof ZodDefault) {
        const defaultValue = innerSchema._def.defaultValue();
        const baseSchema = innerSchema.removeDefault();

        // For complex types, recurse to get full structure
        if (
          baseSchema instanceof ZodArray ||
          baseSchema instanceof ZodObject ||
          baseSchema instanceof ZodUnion ||
          baseSchema instanceof ZodDiscriminatedUnion ||
          baseSchema instanceof ZodRecord
        ) {
          const fullDescription = this.describe(key, baseSchema, nestingLevel);
          // Add the optional and default info to the first line
          const lines = fullDescription.split("\n");
          const firstLine = lines[0];
          if (!firstLine) {
            return fullDescription;
          }
          const commentedFirstLine = firstLine.replace(
            ">",
            `> <!-- default: ${JSON.stringify(defaultValue)}, optional -->`,
          );
          return [commentedFirstLine, ...lines.slice(1)].join("\n");
        }
        const baseType = getTypeLabel(baseSchema);
        return `${indent}<${key}>default: ${JSON.stringify(defaultValue)}, optional ${baseType}</${key}>`;
      }

      // For complex types, recurse to get full structure
      if (
        innerSchema instanceof ZodArray ||
        innerSchema instanceof ZodObject ||
        innerSchema instanceof ZodUnion ||
        innerSchema instanceof ZodDiscriminatedUnion ||
        innerSchema instanceof ZodRecord
      ) {
        const fullDescription = this.describe(key, innerSchema, nestingLevel);
        // Add the optional info to the first line
        const lines = fullDescription.split("\n");
        const firstLine = lines[0];
        if (!firstLine) {
          return fullDescription;
        }
        const commentedFirstLine = firstLine.replace(
          ">",
          "> <!-- optional -->",
        );
        return [commentedFirstLine, ...lines.slice(1)].join("\n");
      }
      const innerType = getTypeLabel(innerSchema);
      return `${indent}<${key}>optional ${innerType}</${key}>`;
    }

    if (subSchema instanceof ZodDefault) {
      const defaultValue = subSchema._def.defaultValue();
      const baseSchema = subSchema.removeDefault();
      const baseType = getTypeLabel(baseSchema);

      if (key === "") {
        return `${getTypeLabel(subSchema)}`;
      }

      return `${indent}<${key}>default: ${JSON.stringify(defaultValue)}, ${baseType}</${key}>`;
    }

    // Handle primitive and special types
    if (
      subSchema instanceof ZodString ||
      subSchema instanceof ZodNumber ||
      subSchema instanceof ZodBoolean ||
      subSchema instanceof ZodEnum ||
      subSchema instanceof ZodLiteral
    ) {
      const typeLabel = getTypeLabel(subSchema);
      const descriptionString = subSchema.description
        ? ` (${subSchema.description})`
        : "";

      if (key === "") {
        return `${typeLabel}${descriptionString}`;
      }

      if (descriptionString) {
        return `${indent}<${key}>${typeLabel}${descriptionString}</${key}>`;
      }
      return `${indent}<${key}>${typeLabel}</${key}>`;
    }

    // Handle union types with better descriptions
    if (subSchema instanceof ZodUnion) {
      const options = subSchema.options;
      const typeDescriptions: string[] = [];

      for (const option of options) {
        let description = "";

        if (option instanceof ZodString) {
          description = "string";
        } else if (option instanceof ZodNumber) {
          description = "number";
        } else if (option instanceof ZodBoolean) {
          description = "boolean";
        } else if (option instanceof ZodObject) {
          // For objects in unions, show a brief structure
          const entries = getPropertyEntries(option);
          const fields = entries
            .slice(0, 3)
            .map(([k]) => k)
            .join(", ");
          const extra = entries.length > 3 ? "..." : "";
          description = `object{${fields}${extra}}`;
        }

        if (!description) {
          description = getTypeLabel(option);
        }

        typeDescriptions.push(description);
      }

      const unionLabel = `union(${typeDescriptions.join(" | ")})`;
      const descriptionString = subSchema.description
        ? ` (${subSchema.description})`
        : "";

      if (key === "") {
        return `${unionLabel}${descriptionString}`;
      }
      return `${indent}<${key}>${unionLabel}${descriptionString}</${key}>`;
    }

    // Handle discriminated unions
    if (subSchema instanceof ZodDiscriminatedUnion) {
      const discriminator = subSchema.discriminator;

      if (key === "") {
        // For root level, show each option's complete structure
        const optionDescriptions = subSchema.options
          .map((option: ZodSchema) => {
            if (option instanceof ZodObject) {
              const entries = getPropertyEntries(option);
              const discField = entries.find(([k]) => k === discriminator);
              let optionName = "option";
              if (discField && discField[1] instanceof ZodLiteral) {
                optionName = String(discField[1].value);
              }

              // Get the full recursive description of this option
              const fullDescription = this.describe("", option, nestingLevel);
              return `${optionName}:\n${fullDescription}`;
            }
            return `${getTypeLabel(option)}`;
          })
          .join("\n\n");

        return `discriminatedUnion(${discriminator}):\n\n${optionDescriptions}`;
      }

      // For nested discriminated unions, show each option's full structure in a formatted way
      const optionDescriptions = subSchema.options
        .map((option: ZodSchema) => {
          if (option instanceof ZodObject) {
            const entries = getPropertyEntries(option);
            const discField = entries.find(([k]) => k === discriminator);
            let optionName = "option";
            if (discField && discField[1] instanceof ZodLiteral) {
              optionName = String(discField[1].value);
            }

            // Get the full recursive description of this option but with proper nesting
            const fullDescription = this.describe("", option, nestingLevel + 1);
            const indentedDescription = fullDescription
              .split("\n")
              .map((line) => (line ? `  ${line}` : line))
              .join("\n");

            return `${optionName}:\n${indentedDescription}`;
          }
          return getTypeLabel(option);
        })
        .join("\n\n");

      return `${indent}<${key}>discriminatedUnion(${discriminator}):\n\n${optionDescriptions}\n${indent}</${key}>`;
    }

    // Handle record types with cleaner structure
    if (subSchema instanceof ZodRecord) {
      const valueSchema = subSchema.valueSchema;
      const descriptionString = subSchema.description
        ? ` (${subSchema.description})`
        : "";

      if (!valueSchema) {
        if (key === "") {
          return "record<string, unknown>";
        }
        return `${indent}<${key}>record&lt;string, unknown&gt;${descriptionString}</${key}>`;
      }

      const valueType = getTypeLabel(valueSchema);
      if (key === "") {
        return `record<string, ${valueType}>`;
      }

      return `${indent}<${key}>record&lt;string, ${valueType}&gt;${descriptionString}</${key}>`;
    }

    if (subSchema instanceof ZodArray) {
      // For arrays, we need to show the complete structure of the element
      const element = subSchema.element;

      if (
        element instanceof ZodString ||
        element instanceof ZodNumber ||
        element instanceof ZodBoolean
      ) {
        // Array of primitives
        const singularKey = getSingularKey(key);
        const elementType = getTypeLabel(element);
        return `${indent}<${key}>\n${indent}  <${singularKey}>${elementType}</${singularKey}> (repeats)\n${indent}</${key}>`;
      }

      if (element instanceof ZodObject) {
        // Array of objects - show the complete structure of each object
        const singularKey = getSingularKey(key);
        const elementDescription = this.describe(
          singularKey,
          element,
          nestingLevel + 1,
        );
        return `${indent}<${key}>\n${elementDescription} (repeats)\n${indent}</${key}>`;
      }

      // For other complex types in arrays (enums, unions, etc.)
      if (
        element instanceof ZodEnum ||
        element instanceof ZodUnion ||
        element instanceof ZodDiscriminatedUnion ||
        element instanceof ZodRecord
      ) {
        const singularKey = getSingularKey(key);
        const elementDescription = this.describe(
          singularKey,
          element,
          nestingLevel + 1,
        );
        return `${indent}<${key}>\n${elementDescription} (repeats)\n${indent}</${key}>`;
      }

      // Handle optional/default wrapped arrays
      if (element instanceof ZodOptional || element instanceof ZodDefault) {
        const singularKey = getSingularKey(key);
        const elementDescription = this.describe(
          singularKey,
          element,
          nestingLevel + 1,
        );
        return `${indent}<${key}>\n${elementDescription} (repeats)\n${indent}</${key}>`;
      }

      // Fallback for other array types
      const singularKey = getSingularKey(key);
      const elementType = getTypeLabel(element);
      return `${indent}<${key}>\n${indent}  <${singularKey}>${elementType}</${singularKey}> (repeats)\n${indent}</${key}>`;
    }

    // Return the top-level properties for objects
    if (subSchema instanceof ZodObject) {
      const entries = getPropertyEntries(subSchema);
      const entriesToRecurseWith = entries.filter(
        ([_, value]) => !value.description?.includes("as_attribute"),
      );

      const childElements = entriesToRecurseWith
        .map(([childKey, value]) => {
          return this.describe(childKey, value, nestingLevel + 1);
        })
        .join("\n");

      const attributes = entries
        .filter(([_, value]) => value.description?.includes("as_attribute"))
        .map(([attrKey, value]) => {
          const description = value.description
            ?.replace("as_attribute", "")
            .trim();
          const attrValue = description ? `${description} ` : "";
          return `${attrKey}="${attrValue}${getTypeLabel(value)}"`;
        })
        .join(" ");

      const useSelfClosingTag = entriesToRecurseWith.length === 0;

      if (key === "") {
        // Root level - no wrapping tag
        return childElements;
      }

      if (useSelfClosingTag) {
        return `${indent}<${key}${attributes ? ` ${attributes}` : ""} />`;
      }

      const openTag = `${indent}<${key}${attributes ? ` ${attributes}` : ""}>`;
      const closeTag = `${indent}</${key}>`;

      if (childElements.trim()) {
        return `${openTag}\n${childElements}\n${closeTag}`;
      }
      return `${openTag}${closeTag}`;
    }

    throw new Error(
      `Unknown schema type in describe: ${subSchema.constructor.name}`,
    );
  }
}

function getTypeLabel(schema: ZodSchema): string {
  if (schema instanceof ZodString) {
    return "string";
  }
  if (schema instanceof ZodNumber) {
    return "number";
  }
  if (schema instanceof ZodBoolean) {
    return "boolean";
  }
  if (schema instanceof ZodEnum) {
    return `enum(${schema.options.join(" | ")})`;
  }
  if (schema instanceof ZodLiteral) {
    return `literal("${schema.value}")`;
  }
  if (schema instanceof ZodUnion) {
    const options = schema.options.map((option: ZodSchema) =>
      getTypeLabel(option),
    );
    return `union(${options.join(" | ")})`;
  }
  if (schema instanceof ZodDiscriminatedUnion) {
    const discriminator = schema.discriminator;
    const options = schema.options.map((option: ZodSchema) => {
      if (option instanceof ZodObject) {
        const entries = getPropertyEntries(option);
        const discField = entries.find(([key]) => key === discriminator);
        if (discField && discField[1] instanceof ZodLiteral) {
          return String(discField[1].value);
        }
      }
      return "option";
    });
    return `discriminatedUnion(${discriminator}: ${options.join(" | ")})`;
  }
  if (schema instanceof ZodOptional) {
    return `${getTypeLabel(schema.unwrap())} (optional)`;
  }
  if (schema instanceof ZodDefault) {
    const defaultValue = schema._def.defaultValue();
    return `${getTypeLabel(schema.removeDefault())} (default: ${JSON.stringify(defaultValue)})`;
  }
  if (schema instanceof ZodRecord) {
    const valueType = schema.valueSchema
      ? getTypeLabel(schema.valueSchema)
      : "unknown";
    return `record<string, ${valueType}>`;
  }
  if (schema instanceof ZodObject) {
    return "object";
  }
  if (schema instanceof ZodArray) {
    return `array<${getTypeLabel(schema.element)}>`;
  }
  // Fallback for any other types
  return "unknown";
}

/**
 * Get the singular form of a key for XML element names
 * Handles edge cases where pluralize.singular() doesn't work as expected
 */
function getSingularKey(key: string): string {
  // Special cases for words that should use "item" as singular
  const specialCases: Record<string, string> = {
    enum: "enumItem",
    required: "requiredItem",
    oneOf: "oneOfItem",
    unknownOf: "unknownOfItem",
    allOf: "allOfItem",
    examples: "example",
    properties: "property",
    definitions: "definition",
    // Add more as needed
  };

  if (specialCases[key]) {
    return specialCases[key];
  }

  // Use pluralize library for standard cases
  const singularized = pluralize.singular(key);

  // If pluralize returns the same word, it's likely not a plural
  // In XML context, use "item" suffix for clarity
  if (singularized === key && !key.endsWith("Item")) {
    return `${key}Item`;
  }

  return singularized;
}

/**
 * Converts Zod errors into LLM-friendly formatted strings
 */
function formatZodError(zodError: z.ZodError, xmlPath: string[] = []): string {
  const formatIssue = (issue: z.ZodIssue, depth = 0): string[] => {
    const indent = "  ".repeat(depth);
    const lines: string[] = [];

    switch (issue.code) {
      case "invalid_type": {
        lines.push(
          `${indent}• Expected ${issue.expected}, but received ${issue.received}`,
        );
        if (issue.expected === "number" && issue.received === "string") {
          lines.push(`${indent}  → Remove quotes around numeric values`);
          lines.push(
            `${indent}  → Example: Change "<id>123</id>" to "<id>123</id>" (without quotes in content)`,
          );
        } else if (
          issue.expected === "boolean" &&
          issue.received === "string"
        ) {
          lines.push(`${indent}  → Use 'true' or 'false' without quotes`);
          lines.push(
            `${indent}  → Example: Change "<active>true</active>" not "<active>'true'</active>"`,
          );
        } else if (issue.expected === "string" && issue.received === "number") {
          lines.push(
            `${indent}  → Wrap numeric values in quotes if they should be strings`,
          );
        } else if (issue.expected === "array" && issue.received === "object") {
          lines.push(
            `${indent}  → Expected multiple elements, but got single object`,
          );
          lines.push(
            `${indent}  → Wrap single items in proper array structure`,
          );
        } else if (issue.expected === "object" && issue.received === "array") {
          lines.push(`${indent}  → Expected single object, but got array`);
          lines.push(
            `${indent}  → Remove array structure or access single element`,
          );
        } else if (issue.received === "undefined") {
          lines.push(`${indent}  → This field is required but missing`);
          lines.push(
            `${indent}  → Add the missing XML element or mark field as optional`,
          );
        } else if (issue.received === "null") {
          lines.push(`${indent}  → Field cannot be null`);
          lines.push(
            `${indent}  → Provide a valid value or remove the element`,
          );
        }
        break;
      }

      case "invalid_literal": {
        lines.push(`${indent}• Invalid literal value`);
        lines.push(`${indent}  → Must be exactly: "${issue.expected}"`);
        lines.push(
          `${indent}  → Check for typos, extra whitespace, or case sensitivity`,
        );
        lines.push(
          `${indent}  → Example: "<type>endpoint</type>" not "<type>Endpoint</type>"`,
        );
        break;
      }

      case "unrecognized_keys": {
        const unrecognized = issue.keys?.join(", ") || "unknown keys";
        lines.push(`${indent}• Unrecognized properties: ${unrecognized}`);
        lines.push(`${indent}  → Remove these properties from the XML`);
        lines.push(`${indent}  → Check for typos in property names`);
        lines.push(`${indent}  → Ensure property names match schema exactly`);
        break;
      }

      case "invalid_union": {
        lines.push(`${indent}• Value doesn't match any allowed union type`);
        if (issue.unionErrors && issue.unionErrors.length > 0) {
          lines.push(
            `${indent}  → Tried ${issue.unionErrors.length} possible formats:`,
          );
          for (let i = 0; i < issue.unionErrors.length; i++) {
            const unionError = issue.unionErrors[i];
            if (unionError && "issues" in unionError) {
              lines.push(`${indent}    Option ${i + 1}:`);
              for (const subIssue of unionError.issues) {
                lines.push(...formatIssue(subIssue, depth + 3));
              }
            }
          }
          lines.push(
            `${indent}  → Try modifying your value to match one of the above options`,
          );
        } else {
          lines.push(
            `${indent}  → Check documentation for allowed union formats`,
          );
          lines.push(`${indent}  → Union types accept multiple valid formats`);
        }
        break;
      }

      case "invalid_union_discriminator": {
        lines.push(`${indent}• Invalid discriminated union discriminator`);
        lines.push(
          `${indent}  → The discriminator field determines which union variant to use`,
        );
        if (issue.options && Array.isArray(issue.options)) {
          lines.push(
            `${indent}  → Valid discriminator values: ${issue.options.join(", ")}`,
          );
        }
        lines.push(
          `${indent}  → Example: "<type>endpoint</type>" where 'type' is the discriminator`,
        );
        break;
      }

      case "invalid_enum_value": {
        const options = issue.options?.join(", ") || "valid options";
        lines.push(`${indent}• Invalid enum value`);
        lines.push(`${indent}  → Must be one of: ${options}`);
        lines.push(
          `${indent}  → Check for typos and ensure exact case matching`,
        );
        lines.push(
          `${indent}  → Enum values are case-sensitive and must match exactly`,
        );
        break;
      }

      case "invalid_arguments": {
        lines.push(`${indent}• Invalid function arguments`);
        lines.push(
          `${indent}  → Check the number and types of arguments provided`,
        );
        lines.push(`${indent}  → Ensure all required parameters are included`);
        break;
      }

      case "invalid_return_type": {
        lines.push(`${indent}• Invalid return type`);
        lines.push(`${indent}  → Function returned unexpected type`);
        lines.push(
          `${indent}  → Check function implementation and return statements`,
        );
        break;
      }

      case "invalid_date": {
        lines.push(`${indent}• Invalid date format`);
        lines.push(
          `${indent}  → Use ISO format: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ`,
        );
        lines.push(
          `${indent}  → Examples: "2024-01-15" or "2024-01-15T10:30:00Z"`,
        );
        lines.push(
          `${indent}  → Avoid relative dates like "yesterday" or "tomorrow"`,
        );
        break;
      }

      case "invalid_string": {
        if (issue.validation === "email") {
          lines.push(`${indent}• Invalid email format`);
          lines.push(`${indent}  → Use format: user@domain.com`);
          lines.push(`${indent}  → Must include @ symbol and valid domain`);
          lines.push(`${indent}  → Example: "user@example.com"`);
        } else if (issue.validation === "url") {
          lines.push(`${indent}• Invalid URL format`);
          lines.push(`${indent}  → Use format: https://example.com`);
          lines.push(
            `${indent}  → Must include protocol (http:// or https://)`,
          );
          lines.push(`${indent}  → Example: "https://www.example.com/path"`);
        } else if (issue.validation === "uuid") {
          lines.push(`${indent}• Invalid UUID format`);
          lines.push(
            `${indent}  → Use format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`,
          );
          lines.push(
            `${indent}  → Example: "123e4567-e89b-12d3-a456-426614174000"`,
          );
        } else if (issue.validation === "regex") {
          lines.push(`${indent}• String doesn't match required pattern`);
          lines.push(`${indent}  → Check the regex pattern requirements`);
          lines.push(`${indent}  → Ensure string format matches exactly`);
        } else if (issue.validation === "cuid") {
          lines.push(`${indent}• Invalid CUID format`);
          lines.push(
            `${indent}  → Use CUID format: c + timestamp + counter + random`,
          );
          lines.push(`${indent}  → Example: "ck2ra4u1800003h5um5kekkjr"`);
        } else if (issue.validation === "cuid2") {
          lines.push(`${indent}• Invalid CUID2 format`);
          lines.push(`${indent}  → Use CUID2 format (improved CUID)`);
          lines.push(`${indent}  → Example: "c123456789abcdef123456"`);
        } else if (issue.validation === "ulid") {
          lines.push(`${indent}• Invalid ULID format`);
          lines.push(`${indent}  → Use ULID format: 26 character string`);
          lines.push(`${indent}  → Example: "01ARZ3NDEKTSV4RRFFQ69G5FAV"`);
        } else if (issue.validation === "nanoid") {
          lines.push(`${indent}• Invalid Nano ID format`);
          lines.push(`${indent}  → Use Nano ID format: URL-safe random string`);
          lines.push(`${indent}  → Example: "V1StGXR8_Z5jdHi6B-myT"`);
        } else if (issue.validation === "datetime") {
          lines.push(`${indent}• Invalid datetime format`);
          lines.push(
            `${indent}  → Use ISO 8601 format: YYYY-MM-DDTHH:mm:ss.sssZ`,
          );
          lines.push(`${indent}  → Example: "2024-01-15T10:30:00.000Z"`);
        } else if (issue.validation === "date") {
          lines.push(`${indent}• Invalid date format`);
          lines.push(`${indent}  → Use ISO date format: YYYY-MM-DD`);
          lines.push(`${indent}  → Example: "2024-01-15"`);
        } else if (issue.validation === "time") {
          lines.push(`${indent}• Invalid time format`);
          lines.push(
            `${indent}  → Use ISO time format: HH:mm:ss or HH:mm:ss.sss`,
          );
          lines.push(`${indent}  → Examples: "14:30:00" or "14:30:00.123"`);
        } else if (issue.validation === "duration") {
          lines.push(`${indent}• Invalid duration format`);
          lines.push(
            `${indent}  → Use ISO 8601 duration format: P[n]Y[n]M[n]DT[n]H[n]M[n]S`,
          );
          lines.push(
            `${indent}  → Examples: "P1Y2M3DT4H5M6S" or "PT30M" (30 minutes)`,
          );
        } else if (issue.validation === "ip") {
          lines.push(`${indent}• Invalid IP address format`);
          lines.push(`${indent}  → Use IPv4 (192.168.1.1) or IPv6 format`);
          lines.push(`${indent}  → Examples: "192.168.1.1" or "2001:db8::1"`);
        } else if (issue.validation === "cidr") {
          lines.push(`${indent}• Invalid CIDR format`);
          lines.push(`${indent}  → Use IP address with subnet mask: IP/prefix`);
          lines.push(
            `${indent}  → Examples: "192.168.1.0/24" or "2001:db8::/32"`,
          );
        } else if (issue.validation === "base64") {
          lines.push(`${indent}• Invalid Base64 format`);
          lines.push(`${indent}  → Use Base64 encoding with standard alphabet`);
          lines.push(
            `${indent}  → Must contain only A-Z, a-z, 0-9, +, / and = padding`,
          );
          lines.push(`${indent}  → Example: "SGVsbG8gV29ybGQ="`);
        } else if (issue.validation === "base64url") {
          lines.push(`${indent}• Invalid Base64URL format`);
          lines.push(`${indent}  → Use Base64URL encoding (URL-safe alphabet)`);
          lines.push(
            `${indent}  → Must contain only A-Z, a-z, 0-9, -, _ (no padding)`,
          );
          lines.push(`${indent}  → Example: "SGVsbG8gV29ybGQ"`);
        } else if (issue.validation === "emoji") {
          lines.push(`${indent}• Invalid emoji format`);
          lines.push(`${indent}  → Must be a valid Unicode emoji character`);
          lines.push(`${indent}  → Examples: "😀", "🎉", "👍", "🚀"`);
        } else if (issue.validation === "jwt") {
          lines.push(`${indent}• Invalid JWT format`);
          lines.push(
            `${indent}  → Must be three Base64URL parts separated by dots`,
          );
          lines.push(`${indent}  → Format: header.payload.signature`);
          lines.push(
            `${indent}  → Example: "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWV9.TJVA95OrM7E2cBab30RMHrHDcEfxjoYZgeFONFh7HgQ"`,
          );
        } else if (
          typeof issue.validation === "object" &&
          issue.validation !== null
        ) {
          if ("includes" in issue.validation) {
            const includes = issue.validation.includes;
            const position = issue.validation.position;
            lines.push(`${indent}• String must include "${includes}"`);
            if (typeof position === "number") {
              lines.push(
                `${indent}  → Must contain "${includes}" starting at position ${position}`,
              );
            } else {
              lines.push(
                `${indent}  → Must contain "${includes}" anywhere in the string`,
              );
            }
            lines.push(`${indent}  → Example: "hello${includes}world"`);
          } else if ("startsWith" in issue.validation) {
            const prefix = issue.validation.startsWith;
            lines.push(`${indent}• String must start with "${prefix}"`);
            lines.push(`${indent}  → Add "${prefix}" to the beginning`);
            lines.push(`${indent}  → Example: "${prefix}your-content-here"`);
          } else if ("endsWith" in issue.validation) {
            const suffix = issue.validation.endsWith;
            lines.push(`${indent}• String must end with "${suffix}"`);
            lines.push(`${indent}  → Add "${suffix}" to the end`);
            lines.push(`${indent}  → Example: "your-content-here${suffix}"`);
          } else {
            lines.push(
              `${indent}• String validation failed: ${JSON.stringify(issue.validation)}`,
            );
            lines.push(`${indent}  → Check format requirements for this field`);
          }
        } else {
          lines.push(
            `${indent}• String validation failed: ${issue.validation}`,
          );
          lines.push(`${indent}  → Check format requirements for this field`);
        }
        break;
      }

      case "too_small": {
        if (issue.type === "array") {
          lines.push(
            `${indent}• Array too small: needs at least ${issue.minimum} items`,
          );
          lines.push(`${indent}  → Add more elements to reach minimum length`);
          lines.push(`${indent}  → Required minimum: ${issue.minimum}`);
        } else if (issue.type === "string") {
          lines.push(
            `${indent}• String too short: needs at least ${issue.minimum} characters`,
          );
          lines.push(
            `${indent}  → Add more characters to reach minimum length`,
          );
          lines.push(`${indent}  → Required minimum: ${issue.minimum}`);
        } else if (issue.type === "number") {
          lines.push(
            `${indent}• Number too small: must be at least ${issue.minimum}`,
          );
          lines.push(
            `${indent}  → Increase the value to meet minimum requirement`,
          );
        } else if (issue.type === "set") {
          lines.push(
            `${indent}• Set too small: needs at least ${issue.minimum} unique items`,
          );
        } else if (issue.type === "date") {
          const minDate =
            typeof issue.minimum === "bigint"
              ? Number(issue.minimum)
              : issue.minimum;
          lines.push(
            `${indent}• Date too early: must be after ${new Date(minDate).toISOString()}`,
          );
        } else {
          lines.push(
            `${indent}• Value too small: must be at least ${issue.minimum}`,
          );
        }
        break;
      }

      case "too_big": {
        if (issue.type === "array") {
          lines.push(
            `${indent}• Array too large: can have at most ${issue.maximum} items`,
          );
          lines.push(
            `${indent}  → Remove elements to stay within maximum length`,
          );
          lines.push(`${indent}  → Maximum allowed: ${issue.maximum}`);
        } else if (issue.type === "string") {
          lines.push(
            `${indent}• String too long: can have at most ${issue.maximum} characters`,
          );
          lines.push(`${indent}  → Shorten the text to stay within limit`);
          lines.push(`${indent}  → Maximum allowed: ${issue.maximum}`);
        } else if (issue.type === "number") {
          lines.push(
            `${indent}• Number too large: must be at most ${issue.maximum}`,
          );
          lines.push(
            `${indent}  → Reduce the value to meet maximum requirement`,
          );
        } else if (issue.type === "set") {
          lines.push(
            `${indent}• Set too large: can have at most ${issue.maximum} unique items`,
          );
        } else if (issue.type === "date") {
          const maxDate =
            typeof issue.maximum === "bigint"
              ? Number(issue.maximum)
              : issue.maximum;
          lines.push(
            `${indent}• Date too late: must be before ${new Date(maxDate).toISOString()}`,
          );
        } else {
          lines.push(
            `${indent}• Value too large: must be at most ${issue.maximum}`,
          );
        }
        break;
      }

      case "invalid_intersection_types": {
        lines.push(
          `${indent}• Value doesn't satisfy intersection requirements`,
        );
        lines.push(
          `${indent}  → Must satisfy ALL intersection conditions simultaneously`,
        );
        lines.push(
          `${indent}  → Check that value meets every constraint in the intersection`,
        );
        break;
      }

      case "not_multiple_of": {
        lines.push(
          `${indent}• Value must be a multiple of ${issue.multipleOf}`,
        );
        const multipleOf = Number(issue.multipleOf);
        lines.push(
          `${indent}  → Use values like: ${multipleOf}, ${multipleOf * 2}, ${multipleOf * 3}, etc.`,
        );
        lines.push(
          `${indent}  → Example: If multipleOf is ${multipleOf}, use ${multipleOf}, ${multipleOf * 2}, ${multipleOf * 3}, etc.`,
        );
        break;
      }

      case "not_finite": {
        lines.push(`${indent}• Value must be finite (not Infinity or NaN)`);
        lines.push(
          `${indent}  → Use regular numbers instead of Infinity or NaN`,
        );
        lines.push(
          `${indent}  → Check for division by zero or invalid math operations`,
        );
        break;
      }

      case "custom": {
        lines.push(`${indent}• ${issue.message}`);
        lines.push(`${indent}  → This is a custom validation error`);
        lines.push(
          `${indent}  → Follow the specific requirements mentioned above`,
        );
        break;
      }

      default: {
        // Handle any other error codes that might exist
        lines.push(`${indent}• Unknown validation error`);
        break;
      }
    }

    // Add complete path information (ROOT + XML path + Zod path)
    if (issue.path && issue.path.length > 0) {
      const completePath = ["ROOT", ...xmlPath, ...issue.path.map(String)];
      const pathStr = completePath.join(" → ");
      lines[0] = `${lines[0]} (at: ${pathStr})`;
    } else if (xmlPath.length > 0) {
      const completePath = ["ROOT", ...xmlPath];
      const pathStr = completePath.join(" → ");
      lines[0] = `${lines[0]} (at: ${pathStr})`;
    } else {
      lines[0] = `${lines[0]} (at: ROOT)`;
    }

    return lines;
  };

  const allLines: string[] = [];

  for (const issue of zodError.issues) {
    allLines.push(...formatIssue(issue));
  }

  return allLines.join("\n");
}

/**
 * Enhanced error class that uses formatted Zod errors
 */
class XmlValidationError extends Error {
  constructor(
    public path: string[],
    public zodError: z.ZodError,
    public received: unknown,
  ) {
    // Use the dedicated formatter with XML path context
    const formattedZodError = formatZodError(zodError, path);

    // Create overall path context
    const overallPath = path.length > 0 ? `ROOT → ${path.join(" → ")}` : "ROOT";

    const message = [
      `XML Validation Error at ${overallPath}`,
      "",
      "Issues found:",
      formattedZodError,
      "",
      "General suggestions:",
      "  • Ensure XML is well-formed with proper opening/closing tags",
      "  • Check that all required fields are present",
      "  • Verify field names match the schema exactly",
      "",
      "Received value:",
      typeof received === "object"
        ? JSON.stringify(received, null, 2)
        : String(received),
    ].join("\n");

    super(message);
    this.name = "XmlValidationError";
  }
}

/**
 * Enhanced error thrower that preserves Zod errors
 */
function throwWithZodError<T>(
  path: string[],
  result: z.SafeParseReturnType<unknown, T>,
  received: unknown,
): T {
  if (result.success) {
    return result.data;
  }

  throw new XmlValidationError(path, result.error, received);
}
