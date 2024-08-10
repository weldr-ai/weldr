export function isCamelCase(str: string): boolean {
  return /^[a-z][a-zA-Z]*$/.test(str);
}

export function toCamelCase(str: string): string {
  // Check if the string is already in camelCase
  if (isCamelCase(str)) {
    return str;
  }

  // Convert to camelCase if not already
  return str
    .toLowerCase() // Convert the entire string to lowercase
    .split(/[\s-_]+/) // Split the string by spaces, hyphens, or underscores
    .map(
      (word, index) =>
        index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1), // Capitalize the first letter of each word except the first one
    )
    .join(""); // Join all words into a single string
}

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
