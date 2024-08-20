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
