import { XMLParser } from "fast-xml-parser";
import {
  ZodArray,
  ZodBoolean,
  ZodDefault,
  ZodDiscriminatedUnion,
  ZodEnum,
  ZodLiteral,
  ZodNumber,
  ZodObject,
  ZodOptional,
  ZodRecord,
  type ZodSchema,
  ZodString,
  ZodUnion,
  z,
} from "zod";

import type { UnknownXML } from "./types";
import {
  getPropertyEntries,
  getSingularKey,
  getTypeLabel,
  getUnparsedStringNodeNames,
  isPrimitive,
  isXMLArray,
  isXMLRecord,
  throwWithZodError,
  XMLValidationError,
} from "./utils";

export class ZodXML<T extends ZodSchema> {
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

  /**
   * Core XML-to-Zod transformation engine implementing sophisticated type coercion and structure mapping.
   * This method represents the heart of the XML validation system and handles incredibly complex scenarios:
   *
   * WRAPPER TYPE HANDLING:
   * - Gracefully unwraps Optional types, returning undefined for null/undefined values
   * - Processes Default types by falling back to default values when data is missing
   *
   * UNION TYPE RESOLUTION:
   * - Attempts each union option sequentially until one succeeds (fail-fast approach)
   * - Provides comprehensive error handling when no union branch matches
   *
   * DISCRIMINATED UNION ROUTING:
   * - Uses discriminator fields to intelligently select the correct union variant
   * - Matches literal discriminator values against available schema options
   *
   * ARRAY PROCESSING COMPLEXITY:
   * The array handling is particularly sophisticated, addressing XML's inherent structural ambiguity:
   *
   * Case 1: Direct arrays where XML structure matches expected array format
   * Case 2: Single-key objects containing arrays (e.g., {users: [user1, user2]})
   * Case 3: Single-key objects with single values that should become single-element arrays
   * Case 4: Complex nested structures requiring intelligent flattening
   *
   * The algorithm uses pluralization logic and structural analysis to determine whether
   * XML elements represent direct array items or wrapped collections, making intelligent
   * decisions about when to flatten vs preserve structure.
   *
   * OBJECT TRANSFORMATION:
   * - Recursively processes object properties while maintaining type safety
   * - Handles nested objects with arbitrary depth
   * - Preserves property relationships and validates against schema constraints
   */
  toZod(
    xml: UnknownXML,
    schema: ZodSchema,
    path: string[],
  ): z.infer<ZodSchema> {
    // Handle wrapper types first
    if (schema instanceof ZodOptional) {
      if (xml === null || xml === undefined) {
        return undefined;
      }
      return this.toZod(xml, schema.unwrap(), path);
    }

    if (schema instanceof ZodDefault) {
      if (xml === null || xml === undefined) {
        return schema._def.defaultValue();
      }
      return this.toZod(xml, schema.removeDefault(), path);
    }

    // Handle union types - try each option until one succeeds
    if (schema instanceof ZodUnion) {
      for (const option of schema.options) {
        try {
          return this.toZod(xml, option, path);
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
              return this.toZod(xml, option, path);
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
          result[key] = this.toZod(value, valueSchema, [...path, key]);
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
      throw new XMLValidationError(
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
        /**
         * Complex XML array structure resolution algorithm.
         * XML parsers create ambiguous structures for arrays, requiring intelligent interpretation:
         *
         * CASE ANALYSIS:
         * 1. Single-key with array value: {users: [user1, user2]}
         *    - Need to determine if this should be direct array or wrapped objects
         *    - Use pluralization logic to detect direct vs wrapped arrays
         *    - Direct arrays: return the array contents directly
         *    - Wrapped arrays: wrap each item with the key name
         *
         * 2. Single-key with object value: {users: {name: "John"}}
         *    - This represents a single array element that XML parser didn't wrap in array
         *    - Transform to single-element array: [{name: "John"}]
         *
         * 3. Multi-key objects or edge cases: fallback to wrapping entire object in array
         *
         * This handles XML's lack of native array syntax by intelligently interpreting
         * the structure based on naming conventions and content patterns.
         */
        // Check if there's only one property which is an array
        const keys = Object.keys(xml);
        const firstKey = keys[0];
        if (!firstKey) {
          throw new XMLValidationError(
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
            // But if firstKeyValues is not an array, wrap it in an array
            const arrayValues = Array.isArray(firstKeyValues)
              ? firstKeyValues
              : [firstKeyValues];
            return throwWithZodError(
              path,
              schema.safeParse(arrayValues),
              arrayValues,
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

        // Case 2a: Single key with primitive value - check if it's a direct array element
        // This handles the case where XML parser creates {categories: {category: "frontend"}}
        // but Zod expects {categories: ["frontend"]}
        if (keys.length === 1) {
          const singularKey = getSingularKey(path[path.length - 1] || "item");

          if (firstKey === singularKey && isPrimitive(firstKeyValues)) {
            // This is a direct array with a single primitive value - extract it
            return throwWithZodError(path, schema.safeParse([firstKeyValues]), [
              firstKeyValues,
            ]);
          }
        }

        // Case 2b: Single key with object value - this is a single array element
        // This handles the case where XML parser creates {declarations: {declaration: {...}}}
        // but Zod expects {declarations: [{...}]}
        if (
          keys.length === 1 &&
          typeof firstKeyValues === "object" &&
          firstKeyValues !== null &&
          !Array.isArray(firstKeyValues)
        ) {
          // Check if this is a direct array case (like categories expecting category values)
          const singularKey = getSingularKey(path[path.length - 1] || "item");

          if (firstKey === singularKey) {
            // This is a direct array - extract the value and put it in an array
            return throwWithZodError(path, schema.safeParse([firstKeyValues]), [
              firstKeyValues,
            ]);
          }

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
          result[key] = this.toZod(xmlValue, value, [...path, key]);
        }
        return result;
      }
    }

    return throwWithZodError(path, schema.safeParse(xml), xml);
  }

  parse(xml: string): z.infer<T> {
    const asJs = this.parser.parse(xml);
    return this.toZod(asJs, this.zSchema, []);
  }

  /**
   * Advanced XML structure description generator optimized for LLM consumption.
   * This method implements a sophisticated recursive descent algorithm that transforms
   * Zod schemas into human-readable, properly formatted XML structure documentation.
   *
   * KEY COMPLEXITIES:
   *
   * WRAPPER TYPE PROCESSING:
   * - Intelligently unwraps Optional/Default types while preserving metadata
   * - Adds contextual comments (<!-- optional -->, <!-- default: value -->) to XML output
   * - Maintains type information through unwrapping layers
   *
   * UNION TYPE DOCUMENTATION:
   * - Generates comprehensive documentation for all union variants
   * - Provides brief structural summaries for complex object unions
   * - Uses intelligent truncation for readability (shows first 3 fields + ...)
   *
   * DISCRIMINATED UNION FORMATTING:
   * - Creates clear documentation showing all possible discriminator values
   * - Formats each variant with proper nesting and indentation
   * - Includes discriminator field information in examples
   *
   * ARRAY STRUCTURE VISUALIZATION:
   * - Uses intelligent pluralization to generate singular element names
   * - Shows complete structure of array elements with "(repeats)" indicators
   * - Handles nested arrays and complex element types recursively
   *
   * ATTRIBUTE HANDLING:
   * - Separates XML attributes from element content using special markers
   * - Generates proper XML attribute syntax in examples
   * - Handles mixed attribute/element schemas correctly
   *
   * INDENTATION AND FORMATTING:
   * - Maintains proper XML indentation for nested structures
   * - Uses self-closing tags where appropriate
   * - Preserves readability while showing complete structure
   *
   * The output is specifically optimized for AI model consumption, providing clear,
   * unambiguous examples that help models generate correctly structured XML.
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

    /**
     * Discriminated union documentation generator with comprehensive variant display.
     * This handles the complex task of documenting all possible discriminated union variants
     * in a clear, structured format that shows:
     * 1. The discriminator field and its possible values
     * 2. Complete structure for each variant option
     * 3. Proper nesting and indentation for readability
     * 4. Integration with recursive schema description for nested complexity
     */
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
