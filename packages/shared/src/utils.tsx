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
