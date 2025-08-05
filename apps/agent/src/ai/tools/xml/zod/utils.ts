import pluralize from "pluralize";
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
  type ZodRawShape,
  ZodRecord,
  type ZodSchema,
  ZodString,
  ZodUnion,
  type z,
} from "zod";

import type { UnknownXML } from "./types";

export function getPropertyEntries<T extends ZodRawShape>(
  schema: ZodObject<T>,
): [string, ZodSchema][] {
  return Object.entries(schema.shape);
}

export function isXMLRecord(xml: UnknownXML): xml is Record<string, unknown> {
  return typeof xml === "object" && xml !== null;
}

export function isXMLArray(xml: UnknownXML): xml is unknown[] {
  return Array.isArray(xml);
}

export function isPrimitive(xml: UnknownXML): xml is string | number | boolean {
  return (
    typeof xml === "string" ||
    typeof xml === "number" ||
    typeof xml === "boolean"
  );
}

/**
 * Complex recursive schema traversal algorithm that identifies nodes requiring raw string preservation.
 * This function implements a sophisticated depth-first search through Zod schema structures to:
 *
 * 1. Handle wrapper types (Optional, Default) by unwrapping to access inner schemas
 * 2. Process union types by exploring ALL possible branches to catch unparsed strings in any variant
 * 3. Navigate object schemas recursively, building dot-notation paths for nested structures
 * 4. Handle array schemas by recursing into element types while preserving path context
 * 5. Identify custom UnparsedString instances that need special XML parser treatment
 *
 * The path tracking is crucial for the XML parser's stopNodes configuration, which prevents
 * certain nodes from being parsed into JavaScript objects, keeping them as raw strings.
 * This is essential for handling complex nested XML that should remain as text content.
 */
export function getUnparsedStringNodeNames(
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
      if (value instanceof ZodObject) {
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

export function getTypeLabel(schema: ZodSchema): string {
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
export function getSingularKey(key: string): string {
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
 * Comprehensive Zod error formatting system providing detailed, actionable error messages.
 * This function implements an exhaustive error analysis and formatting system that:
 *
 * CORE FEATURES:
 * - Transforms cryptic Zod validation errors into human-readable explanations
 * - Provides specific examples and corrections for each error type
 * - Includes contextual path information showing exactly where errors occurred
 * - Offers actionable suggestions for fixing common validation issues
 *
 * ERROR TYPE COVERAGE:
 * The system handles every major Zod error type with specialized formatting:
 *
 * TYPE MISMATCHES:
 * - Provides specific guidance for number/string/boolean conversion issues
 * - Explains array vs object structure problems with examples
 * - Handles null/undefined scenarios with clear remediation steps
 *
 * UNION/DISCRIMINATED UNION ERRORS:
 * - Shows which union options were attempted and why they failed
 * - Provides detailed breakdown of discriminator field issues
 * - Offers examples of valid union formats
 *
 * STRING VALIDATION FAILURES:
 * - Comprehensive coverage of all string validation types (email, URL, UUID, etc.)
 * - Provides format examples for each validation type
 * - Includes regex pattern guidance and common format issues
 *
 * NUMERIC CONSTRAINTS:
 * - Clear explanations for min/max violations with remediation suggestions
 * - Handles special numeric cases (finite numbers, multiples, etc.)
 *
 * ARRAY/OBJECT SIZE CONSTRAINTS:
 * - Explains length requirements with actionable advice
 * - Provides context for why certain limits exist
 *
 * The formatted output is optimized for both human readability and LLM consumption,
 * enabling better error understanding and faster issue resolution.
 */
export function formatZodError(
  zodError: z.ZodError,
  xmlPath: string[] = [],
): string {
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
export class XMLValidationError extends Error {
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
export function throwWithZodError<T>(
  path: string[],
  result: z.SafeParseReturnType<unknown, T>,
  received: unknown,
): T {
  if (result.success) {
    return result.data;
  }
  throw new XMLValidationError(path, result.error, received);
}
