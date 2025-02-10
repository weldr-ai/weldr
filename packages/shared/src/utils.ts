import type { AssistantMessageRawContent } from "./types";

export function toKebabCase(str: string): string {
  return (
    str
      // Handle camelCase and PascalCase
      .replace(/([A-Z])/g, (match, p1, offset) =>
        offset > 0 ? `-${p1.toLowerCase()}` : p1.toLowerCase(),
      )
      // Handle snake_case
      .replace(/_/g, "-")
      .toLowerCase()
  );
}

export function toSentence(str: string): string {
  return str.replace(/([A-Z])/g, (match, p1, offset) =>
    offset > 0 ? ` ${p1}` : p1,
  );
}

export function toTitle(str: string): string {
  return (
    str
      // Handle kebab-case and snake_case
      .replace(/[-_]/g, " ")
      // Handle camelCase and PascalCase
      .replace(/([A-Z])/g, (match, p1, offset) => (offset > 0 ? ` ${p1}` : p1))
      // Capitalize first letter of each word
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ")
  );
}

export function assistantMessageRawContentToText(
  rawMessageContent: AssistantMessageRawContent = [],
): string {
  return rawMessageContent
    .map((element) => {
      switch (element.type) {
        case "paragraph": {
          return element.value;
        }
        case "reference": {
          return element.name;
        }
      }
    })
    .join("");
}
