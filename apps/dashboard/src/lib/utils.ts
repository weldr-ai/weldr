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

function isCamelCase(str: string): boolean {
  return /^[a-z][a-zA-Z]*$/.test(str);
}
