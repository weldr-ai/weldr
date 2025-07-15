import Handlebars from "handlebars";

export function getVariablesFromTemplate(
  template: string,
): Record<string, string> {
  try {
    const ast = Handlebars.parse(template);
    const variables: Record<string, string> = {};

    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    function traverseNode(node: any) {
      if (!node) return;

      if (node.type === "MustacheStatement" || node.type === "SubExpression") {
        if (node.path && node.path.type === "PathExpression") {
          const varName = node.path.original;
          if (varName && !isHandlebarsHelper(varName)) {
            variables[varName] = "string";
          }
        }
      } else if (node.type === "BlockStatement") {
        if (node.path && node.path.type === "PathExpression") {
          const varName = node.path.original;
          if (varName && !isHandlebarsHelper(varName)) {
            variables[varName] = "string";
          }
        }

        if (node.program?.body) {
          node.program.body.forEach(traverseNode);
        }

        if (node.inverse?.body) {
          node.inverse.body.forEach(traverseNode);
        }
      }

      if (node.params) {
        for (const param of node.params) {
          if (param.type === "PathExpression") {
            const varName = param.original;
            if (varName && !isHandlebarsHelper(varName)) {
              variables[varName] = "string";
            }
          }
        }
      }

      // Recursively traverse child nodes
      if (node.body) {
        node.body.forEach(traverseNode);
      }
    }

    // Start traversing from root statements
    if (ast.body) {
      ast.body.forEach(traverseNode);
    }

    return variables;
  } catch (error) {
    console.error("Error parsing handlebars template:", error);
    return {};
  }
}

/**
 * Check if a variable name is a built-in handlebars helper
 */
export function isHandlebarsHelper(name: string): boolean {
  const builtinHelpers = [
    "if",
    "unless",
    "each",
    "with",
    "lookup",
    "log",
    "blockHelperMissing",
    "helperMissing",
    "this",
    "else",
  ];
  return builtinHelpers.includes(name);
}
