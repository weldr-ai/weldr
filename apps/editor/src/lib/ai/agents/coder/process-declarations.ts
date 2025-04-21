import type { DeclarationDependency } from "@weldr/db/schema";
import * as ts from "typescript";

// Add configuration interface at the top level
interface Config {
  srcDir?: string;
  schemaDir?: string;
  rpcsDir?: string;
  apiDir?: string;
}

// Default configuration
const DEFAULT_CONFIG: Config = {
  srcDir: "src",
  schemaDir: "server/db/schema",
  rpcsDir: "server/api/routers",
  apiDir: "app/api",
};

// Add helper function to extract package name
function extractPackageName(importPath: string): string {
  // Handle scoped packages like @angular/cli
  if (importPath.startsWith("@")) {
    const parts = importPath.split("/");
    if (parts.length >= 2) {
      return `${parts[0]}/${parts[1]}`;
    }
    return importPath; // Return full path if we can't extract scope/name
  }

  // Handle regular packages and extract the first part before any path
  const firstPart = importPath.split("/")[0];
  return firstPart || importPath; // Return full path if split fails
}

export interface DeclarationChanges {
  newDeclarations: Record<string, DeclarationDependency[]>;
  updatedDeclarations: Record<string, DeclarationDependency[]>;
  deletedDeclarations: Record<string, DeclarationDependency[]>;
}

function findUsedIdentifiers(node: ts.Node, identifiers: Set<string>) {
  if (ts.isIdentifier(node)) {
    identifiers.add(node.text);
  } else if (ts.isPropertyAccessExpression(node)) {
    let current: ts.Expression = node;
    const parts: string[] = [];

    while (ts.isPropertyAccessExpression(current)) {
      parts.unshift(current.name.text);
      current = current.expression;
    }

    if (ts.isIdentifier(current)) {
      parts.unshift(current.text);
      identifiers.add(parts.join("."));
    }
  }

  ts.forEachChild(node, (child) => findUsedIdentifiers(child, identifiers));
}

const HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "DELETE",
  "PATCH",
  "HEAD",
  "OPTIONS",
] as const;

// Helper function to get the text of a node
function getNodeText(node: ts.Node, sourceFile: ts.SourceFile): string {
  return node.getText(sourceFile);
}

// Modify the function signature to include the new return type
export function processDeclarations({
  fileContent,
  filePath,
  config = DEFAULT_CONFIG,
  previousContent,
}: {
  fileContent: string;
  filePath: string;
  config?: Config;
  previousContent?: string;
}): DeclarationChanges {
  // If no previous content provided, process everything as new declarations
  if (!previousContent) {
    const declarations = processAllDeclarations(fileContent, filePath, config);
    return {
      newDeclarations: declarations,
      updatedDeclarations: {},
      deletedDeclarations: {},
    };
  }

  // Create source files for both old and new content
  const oldSourceFile = ts.createSourceFile(
    filePath,
    previousContent,
    ts.ScriptTarget.Latest,
    true,
  );
  const newSourceFile = ts.createSourceFile(
    filePath,
    fileContent,
    ts.ScriptTarget.Latest,
    true,
  );

  // If previous content is provided, compare and process changes
  const newDeclarations: Record<string, DeclarationDependency[]> = {};
  const updatedDeclarations: Record<string, DeclarationDependency[]> = {};
  const deletedDeclarations: Record<string, DeclarationDependency[]> = {};

  // Process the old content first to get the baseline
  const oldDeclarations = processAllDeclarations(
    previousContent,
    filePath,
    config,
  );
  const oldNodes = new Map<string, ts.Node>();

  // Store old nodes for comparison
  ts.forEachChild(oldSourceFile, function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      oldNodes.set(node.name.text, node);
    } else if (ts.isFunctionDeclaration(node) && node.name) {
      oldNodes.set(node.name.text, node);
    } else if (ts.isClassDeclaration(node) && node.name) {
      oldNodes.set(node.name.text, node);
    } else if (ts.isInterfaceDeclaration(node)) {
      oldNodes.set(node.name.text, node);
    } else if (ts.isTypeAliasDeclaration(node)) {
      oldNodes.set(node.name.text, node);
    }
    ts.forEachChild(node, visit);
  });

  // Process the new content to compare against
  const currentDeclarations = processAllDeclarations(
    fileContent,
    filePath,
    config,
  );
  const newNodes = new Map<string, ts.Node>();

  // Store new nodes for comparison
  ts.forEachChild(newSourceFile, function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      newNodes.set(node.name.text, node);
    } else if (ts.isFunctionDeclaration(node) && node.name) {
      newNodes.set(node.name.text, node);
    } else if (ts.isClassDeclaration(node) && node.name) {
      newNodes.set(node.name.text, node);
    } else if (ts.isInterfaceDeclaration(node)) {
      newNodes.set(node.name.text, node);
    } else if (ts.isTypeAliasDeclaration(node)) {
      newNodes.set(node.name.text, node);
    }
    ts.forEachChild(node, visit);
  });

  // Compare declarations to categorize them
  for (const [name, deps] of Object.entries(currentDeclarations)) {
    if (!(name in oldDeclarations)) {
      // This is a new declaration
      newDeclarations[name] = deps;
    } else {
      // Check if the implementation has changed by comparing the node text
      const oldNode = oldNodes.get(name);
      const newNode = newNodes.get(name);

      if (oldNode && newNode) {
        const oldText = getNodeText(oldNode, oldSourceFile);
        const newText = getNodeText(newNode, newSourceFile);

        if (oldText !== newText) {
          // This is an updated declaration
          updatedDeclarations[name] = deps;
        }
      }
    }
  }

  // Find removed declarations
  for (const [name, deps] of Object.entries(oldDeclarations)) {
    if (!(name in currentDeclarations)) {
      // This is a removed declaration
      deletedDeclarations[name] = deps;
    }
  }

  return {
    newDeclarations,
    updatedDeclarations,
    deletedDeclarations,
  };
}

// Helper function to process all declarations in a file
function processAllDeclarations(
  fileContent: string,
  filePath: string,
  config: Config,
): Record<string, DeclarationDependency[]> {
  const sourceFile = ts.createSourceFile(
    filePath,
    fileContent,
    ts.ScriptTarget.Latest,
    true,
  );

  function resolveToProjectPath(
    importPath: string,
    currentFile: string,
  ): string {
    if (importPath.startsWith("@/")) {
      return importPath.replace("@/", "/src/");
    }

    if (importPath.startsWith("/")) {
      return importPath;
    }

    // Simple relative path resolution
    const currentDir = currentFile.substring(0, currentFile.lastIndexOf("/"));
    const parts = importPath.split("/");
    const resultParts = currentDir.split("/");

    for (const part of parts) {
      if (part === "..") {
        resultParts.pop();
      } else if (part !== ".") {
        resultParts.push(part);
      }
    }

    return resultParts.join("/");
  }

  function resolveImportPath(importPath: string, currentFile: string): string {
    if (importPath.startsWith("@/")) {
      const importFile = importPath.replace("@/", "/src/");
      return !importPath.endsWith(".ts") && !importPath.endsWith(".tsx")
        ? `${importFile}.ts`
        : importFile;
    }

    if (importPath.startsWith(".")) {
      if (!importPath.endsWith(".ts") && !importPath.endsWith(".tsx")) {
        const basePath = resolveToProjectPath(importPath, currentFile);
        // Always default to .ts extension since we can't check filesystem
        return `${basePath}.ts`;
      }
      return resolveToProjectPath(importPath, currentFile);
    }

    return importPath;
  }

  // Update path checking functions to use config
  function isSchemaFile(filePath: string): boolean {
    return filePath.includes(`/${config.srcDir}/${config.schemaDir}/`);
  }

  function isRpcFile(filePath: string): boolean {
    return filePath.includes(`/${config.srcDir}/${config.rpcsDir}/`);
  }

  function isApiRoute(filePath: string): boolean {
    return filePath.includes(`/${config.srcDir}/${config.apiDir}/`);
  }

  const declarations: Record<string, DeclarationDependency[]> = {};
  const importsByFile = new Map<string, Set<string>>();
  const externalDeps = new Set<string>();
  const allDeclarations = new Map<string, boolean>();
  const declarationNodes = new Map<string, ts.Node>();
  const importedIdentifiers = new Map<
    string,
    { isExternal: boolean; source: string }
  >();

  function hasExportModifier(node: ts.Node): boolean {
    if (!ts.canHaveModifiers(node)) return false;
    const modifiers = ts.getModifiers(node);
    return (
      modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
      ) ?? false
    );
  }

  function isRelation(node: ts.Node): boolean {
    if (!ts.isVariableDeclaration(node)) return false;

    // Check if the initializer is a call to relations
    if (node.initializer && ts.isCallExpression(node.initializer)) {
      const expression = node.initializer.expression;
      if (ts.isIdentifier(expression) && expression.text === "relations") {
        return true;
      }
    }
    return false;
  }

  function isRouterProcedure(node: ts.Node): {
    isProc: boolean;
    name?: string;
  } {
    if (!ts.isPropertyAssignment(node)) return { isProc: false };

    // Get the property name
    const name = ts.isIdentifier(node.name)
      ? node.name.text
      : ts.isStringLiteral(node.name)
        ? node.name.text
        : undefined;

    if (!name) return { isProc: false };

    // Check for patterns like:
    // something: publicProcedure.query(...)
    // something: publicProcedure.mutation(...)
    // something: publicProcedure.input(...).mutation(...)
    // something: protectedProcedure.input(...).query(...)
    if (node.initializer && ts.isCallExpression(node.initializer)) {
      let current: ts.Node = node.initializer;

      // Keep track of all identifiers in the chain
      const identifiers: string[] = [];

      while (current) {
        if (ts.isCallExpression(current)) {
          if (ts.isIdentifier(current.expression)) {
            identifiers.push(current.expression.text);
          } else if (ts.isPropertyAccessExpression(current.expression)) {
            let prop = current.expression;
            while (prop) {
              if (ts.isIdentifier(prop.name)) {
                identifiers.push(prop.name.text);
              }
              if (ts.isPropertyAccessExpression(prop.expression)) {
                prop = prop.expression;
              } else if (ts.isIdentifier(prop.expression)) {
                identifiers.push(prop.expression.text);
                break;
              } else {
                break;
              }
            }
          }
          current = current.expression;
        } else if (ts.isPropertyAccessExpression(current)) {
          if (ts.isIdentifier(current.name)) {
            identifiers.push(current.name.text);
          }
          current = current.expression;
        } else if (ts.isIdentifier(current)) {
          identifiers.push(current.text);
          break;
        } else {
          break;
        }
      }

      // Check if any of the identifiers indicate this is a procedure
      const procedureIdentifiers = ["publicProcedure", "protectedProcedure"];
      const procedureOperations = ["query", "mutation"];

      const hasProcedure = identifiers.some((id) =>
        procedureIdentifiers.includes(id),
      );
      const hasOperation = identifiers.some((id) =>
        procedureOperations.includes(id),
      );

      if (hasProcedure && hasOperation) {
        return { isProc: true, name };
      }
    }
    return { isProc: false };
  }

  // Split the large processDeclaration function into smaller parts
  function processApiRouteDeclaration(
    name: string,
    node: ts.Node,
    importedIdentifiers: Map<string, { isExternal: boolean; source: string }>,
    importsByFile: Map<string, Set<string>>,
  ): DeclarationDependency[] | null {
    // Check if this is a valid HTTP method
    if (!HTTP_METHODS.includes(name as (typeof HTTP_METHODS)[number])) {
      return null;
    }

    // Extract the API path from the file path for Next.js App Router
    const apiPath = `/api${
      filePath
        .replace(/^.*\/app\/api/, "") // Remove everything before and including app/api
        .replace(/\/route\.(ts|js|tsx|jsx)$/, "") // Remove route.ts and its variants
        .replace(/\(.*?\)\//g, "") // Remove route groups (...)
        .replace(/\/\(\.{3}([^)]+)\)/g, "/{$1}") // Replace (...param) with {param}
        .replace(/\/\[\.{3}([^\]]+)\]/g, "/{$1}") // Replace [...param] with {param}
        .replace(/\/\[\[\.{3}([^\]]+)\]\]/g, "/{$1}") // Replace [[...param]] with {param}
        .replace(/\/\[([^\]]+)\]/g, "/{$1}") || // Replace [param] with {param}
      ""
    }`;

    // Format the declaration name as METHOD:/path
    const declarationName = `${name}:${apiPath}`;

    // Rest of the existing processApiRouteDeclaration logic
    const usedIdentifiers = new Set<string>();

    if (
      ts.isExportDeclaration(node) &&
      node.exportClause &&
      ts.isNamedExports(node.exportClause)
    ) {
      for (const element of node.exportClause.elements) {
        if (element.propertyName) {
          usedIdentifiers.add(element.propertyName.text);
        }
      }
    } else {
      findUsedIdentifiers(node, usedIdentifiers);
    }

    const usedInternalDeps = new Map<string, Set<string>>();
    const usedExternalDeps = new Map<string, Set<string>>();

    processUsedIdentifiers(
      usedIdentifiers,
      importedIdentifiers,
      importsByFile,
      usedInternalDeps,
      usedExternalDeps,
    );

    const resultObj: DeclarationDependency[] = [];

    for (const [file, declarations] of usedInternalDeps.entries()) {
      if (declarations.size > 0) {
        resultObj.push({
          type: "internal",
          from: file,
          dependsOn: Array.from(declarations),
        });
      }
    }

    for (const [importPath, declarations] of usedExternalDeps.entries()) {
      if (declarations.size > 0) {
        resultObj.push({
          type: "external",
          from: importPath,
          dependsOn: Array.from(declarations),
          name: extractPackageName(importPath),
        });
      }
    }

    if (resultObj.length > 0) {
      // Store the result using the declarationName (METHOD:path) instead of just the method name
      declarations[declarationName] = resultObj;
      return resultObj;
    }

    // Even if there are no dependencies, we should still register the API endpoint
    declarations[declarationName] = [];
    return [];
  }

  function processUsedIdentifiers(
    usedIdentifiers: Set<string>,
    importedIdentifiers: Map<string, { isExternal: boolean; source: string }>,
    importsByFile: Map<string, Set<string>>,
    usedInternalDeps: Map<string, Set<string>>,
    usedExternalDeps: Map<string, Set<string>>,
  ): void {
    // Add bare imports to dependencies
    importsByFile.forEach((declarations, file) => {
      if (declarations.size === 0) {
        if (!usedInternalDeps.has(file)) {
          usedInternalDeps.set(file, new Set());
        }
      }
    });

    for (const id of usedIdentifiers) {
      const importInfo = importedIdentifiers.get(id);
      if (importInfo) {
        if (importInfo.isExternal) {
          if (!usedExternalDeps.has(importInfo.source)) {
            usedExternalDeps.set(importInfo.source, new Set());
          }
          usedExternalDeps.get(importInfo.source)?.add(id);
        } else {
          const importFile = resolveImportPath(importInfo.source, filePath);
          if (!usedInternalDeps.has(importFile)) {
            usedInternalDeps.set(importFile, new Set());
          }
          usedInternalDeps.get(importFile)?.add(id);
        }
      }
    }
  }

  function processDeclaration(name: string, node: ts.Node, isExported = false) {
    if (isApiRoute(filePath)) {
      // Extract the API path from the file path for Next.js App Router
      const apiPath = `/api${
        filePath
          .replace(/^.*\/app\/api/, "") // Remove everything before and including app/api
          .replace(/\/route\.(ts|js|tsx|jsx)$/, "") // Remove route.ts and its variants
          .replace(/\(.*?\)\//g, "") // Remove route groups (...)
          .replace(/\/\(\.{3}([^)]+)\)/g, "/{$1}") // Replace (...param) with {param}
          .replace(/\/\[\.{3}([^\]]+)\]/g, "/{$1}") // Replace [...param] with {param}
          .replace(/\/\[\[\.{3}([^\]]+)\]\]/g, "/{$1}") // Replace [[...param]] with {param}
          .replace(/\/\[([^\]]+)\]/g, "/{$1}") || // Replace [param] with {param}
        ""
      }`;

      // Format the declaration name as METHOD:/path
      const declarationName = `${name}:${apiPath}`;

      const apiRouteDecl = processApiRouteDeclaration(
        name,
        node,
        importedIdentifiers,
        importsByFile,
      );
      if (apiRouteDecl) {
        declarations[declarationName] = apiRouteDecl;
        return;
      }
    }

    // Skip relations in schema files
    if (isSchemaFile(filePath) && isRelation(node)) {
      return;
    }

    // For router files, we want to process each procedure
    if (isRpcFile(filePath) && ts.isVariableDeclaration(node)) {
      if (node.initializer && ts.isObjectLiteralExpression(node.initializer)) {
        // Process each property in the router object
        for (const prop of node.initializer.properties) {
          const procInfo = isRouterProcedure(prop);
          if (procInfo.isProc && procInfo.name) {
            // Process each procedure as a separate declaration
            const procedureName = `${name}.${procInfo.name}`;
            // Skip if we've already processed this procedure
            if (!(procedureName in declarations)) {
              processDeclaration(procedureName, prop, true);
            }
            return;
          }
        }
        // Don't process the entire router object
        return;
      }
    }

    // Store the node for later processing
    declarationNodes.set(name, node);

    if (!allDeclarations.has(name)) {
      allDeclarations.set(name, isExported || hasExportModifier(node));
    }
    if (allDeclarations.get(name)) {
      // Skip if we've already processed this declaration
      if (name in declarations) {
        return;
      }
      // Find all identifiers used in this declaration
      const usedIdentifiers = new Set<string>();
      findUsedIdentifiers(node, usedIdentifiers);

      // Track namespace imports separately
      const namespaceImports = new Map<string, string>();
      for (const statement of sourceFile.statements) {
        if (ts.isImportDeclaration(statement)) {
          const importPath = (statement.moduleSpecifier as ts.StringLiteral)
            .text;
          if (
            statement.importClause?.namedBindings &&
            ts.isNamespaceImport(statement.importClause.namedBindings)
          ) {
            namespaceImports.set(
              statement.importClause.namedBindings.name.text,
              importPath,
            );
          }
        }
      }

      // Group used imports by their source file/package
      const usedInternalDeps = new Map<string, Set<string>>();
      const usedExternalDeps = new Map<string, Set<string>>();

      // Process namespace imports
      for (const id of usedIdentifiers) {
        // Check if this identifier is accessing a namespace import
        for (const [namespace, importPath] of namespaceImports.entries()) {
          if (id.startsWith(`${namespace}.`)) {
            const member = id.slice(namespace.length + 1);
            if (!usedExternalDeps.has(importPath)) {
              usedExternalDeps.set(importPath, new Set());
            }
            usedExternalDeps.get(importPath)?.add(member);
          }
        }
      }

      // Process regular imports
      for (const id of usedIdentifiers) {
        const importInfo = importedIdentifiers.get(id);
        if (importInfo) {
          if (importInfo.isExternal) {
            if (!usedExternalDeps.has(importInfo.source)) {
              usedExternalDeps.set(importInfo.source, new Set());
            }
            usedExternalDeps.get(importInfo.source)?.add(id);
          } else {
            const importFile = resolveImportPath(importInfo.source, filePath);
            if (!usedInternalDeps.has(importFile)) {
              usedInternalDeps.set(importFile, new Set());
            }
            usedInternalDeps.get(importFile)?.add(id);
          }
        }
      }

      // Create the base result object
      const resultObj: DeclarationDependency[] = [];

      // Add internal dependencies
      for (const [file, declarations] of usedInternalDeps.entries()) {
        if (declarations.size > 0) {
          resultObj.push({
            type: "internal",
            from: file,
            dependsOn: Array.from(declarations),
          });
        }
      }

      // Add external dependencies
      for (const [importPath, declarations] of usedExternalDeps.entries()) {
        if (declarations.size > 0) {
          resultObj.push({
            type: "external",
            from: importPath,
            dependsOn: Array.from(declarations),
            name: extractPackageName(importPath),
          });
        }
      }

      if (resultObj.length > 0) {
        declarations[name] = resultObj;
      }
    }
  }

  function processNode(node: ts.Node) {
    if (node.parent && !ts.isSourceFile(node.parent)) {
      // For nested declarations, check if they are exported
      if (ts.isVariableStatement(node)) {
        for (const decl of node.declarationList.declarations) {
          if (
            ts.isIdentifier(decl.name) &&
            (!isSchemaFile(filePath) || !isRelation(decl))
          ) {
            processDeclaration(decl.name.text, decl);
          }
        }
      }
      return;
    }

    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (
          ts.isIdentifier(decl.name) &&
          (!isSchemaFile(filePath) || !isRelation(decl))
        ) {
          processDeclaration(decl.name.text, decl);
        }
      }
    } else if (ts.isFunctionDeclaration(node) && node.name) {
      processDeclaration(node.name.text, node);
    } else if (ts.isClassDeclaration(node) && node.name) {
      processDeclaration(node.name.text, node);
    } else if (ts.isInterfaceDeclaration(node)) {
      processDeclaration(node.name.text, node);
    } else if (ts.isTypeAliasDeclaration(node)) {
      processDeclaration(node.name.text, node);
    } else if (ts.isExportAssignment(node)) {
      // Handle export default and export =
      if (ts.isIdentifier(node.expression)) {
        // If default export references an existing declaration, just track that
        allDeclarations.set(node.expression.text, true);
        declarationNodes.set(node.expression.text, node);
      } else {
        // Only track anonymous default exports
        const defaultName = "default";
        allDeclarations.set(defaultName, true);
        declarationNodes.set(defaultName, node);
      }
    } else if (
      ts.isFunctionDeclaration(node) ||
      ts.isClassDeclaration(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isTypeAliasDeclaration(node) ||
      ts.isEnumDeclaration(node)
    ) {
      const isExported = hasExportModifier(node);
      const isDefaultExport = node.modifiers?.some(
        (mod) => mod.kind === ts.SyntaxKind.DefaultKeyword,
      );

      if (node.name) {
        // For named declarations, always track by their actual name
        if (isExported || isDefaultExport) {
          allDeclarations.set(node.name.text, true);
          declarationNodes.set(node.name.text, node);
        }
      } else if (isDefaultExport) {
        // Only track anonymous default exports as "default"
        allDeclarations.set("default", true);
        declarationNodes.set("default", node);
      }
    }

    ts.forEachChild(node, processNode);
  }

  function collectImports(node: ts.Node) {
    if (ts.isImportDeclaration(node)) {
      const importPath = (node.moduleSpecifier as ts.StringLiteral).text;

      // Handle bare imports (import "package" or import "./file")
      if (!node.importClause) {
        if (importPath.startsWith(".") || importPath.startsWith("@/")) {
          let importFile = importPath;
          if (importPath.startsWith("@/")) {
            importFile = importPath.replace("@/", "/src/");
          } else if (importPath.startsWith(".")) {
            importFile = resolveToProjectPath(importPath, filePath);
          }
          // Don't add .ts extension for non-TypeScript files
          if (!/\.(css|scss|less|json|md|mdx|jsx?|tsx?)$/.exec(importFile)) {
            importFile = `${importFile}.ts`;
          }
          importsByFile.set(importFile, new Set());
        } else {
          externalDeps.add(
            JSON.stringify({
              importPath,
              declarations: [],
            }),
          );
        }
      }

      // Track imported identifiers and their source
      if (node.importClause) {
        if (node.importClause.name) {
          importedIdentifiers.set(node.importClause.name.text, {
            isExternal:
              !importPath.startsWith(".") && !importPath.startsWith("@/"),
            source: importPath,
          });
        }
        if (
          node.importClause.namedBindings &&
          ts.isNamedImports(node.importClause.namedBindings)
        ) {
          for (const element of node.importClause.namedBindings.elements) {
            importedIdentifiers.set(element.name.text, {
              isExternal:
                !importPath.startsWith(".") && !importPath.startsWith("@/"),
              source: importPath,
            });
          }
        }
      }

      // Store in importsByFile for backward compatibility
      let importFile = importPath;
      if (importPath.startsWith("@/") || importPath.startsWith(".")) {
        if (importPath.startsWith("@/")) {
          importFile = importPath.replace("@/", "/src/");
          if (!/\.(css|scss|less|json|md|mdx|jsx?|tsx?)$/.exec(importPath)) {
            importFile = `${importFile}.ts`;
          }
        } else if (importPath.startsWith(".")) {
          if (!/\.(css|scss|less|json|md|mdx|jsx?|tsx?)$/.exec(importPath)) {
            const basePath = resolveToProjectPath(importPath, filePath);
            importFile = `${basePath}.ts`; // Always default to .ts
          } else {
            importFile = resolveToProjectPath(importPath, filePath);
          }
        }

        const importedDeclarations = new Set<string>();
        if (node.importClause) {
          if (node.importClause.name) {
            importedDeclarations.add(node.importClause.name.text);
          }
          if (
            node.importClause.namedBindings &&
            ts.isNamedImports(node.importClause.namedBindings)
          ) {
            for (const element of node.importClause.namedBindings.elements) {
              importedDeclarations.add(element.name.text);
            }
          }
        }
        importsByFile.set(importFile, importedDeclarations);
      } else {
        const importedDeclarations: string[] = [];
        if (node.importClause) {
          if (node.importClause.name) {
            importedDeclarations.push(node.importClause.name.text);
          }
          if (
            node.importClause.namedBindings &&
            ts.isNamedImports(node.importClause.namedBindings)
          ) {
            for (const element of node.importClause.namedBindings.elements) {
              importedDeclarations.push(element.name.text);
            }
          }
        }
        externalDeps.add(
          JSON.stringify({
            importPath,
            declarations: importedDeclarations,
          }),
        );
      }
    } else if (ts.isExportDeclaration(node)) {
      // Handle named exports like: export { foo, bar }
      if (node.exportClause && ts.isNamedExports(node.exportClause)) {
        for (const element of node.exportClause.elements) {
          const exportedName = element.name.text;
          const propertyName = element.propertyName?.text;

          // If this is an aliased export (like 'handler as GET')
          if (
            propertyName &&
            HTTP_METHODS.includes(exportedName as (typeof HTTP_METHODS)[number])
          ) {
            // Store both the original name and the alias
            allDeclarations.set(exportedName, true);
            declarationNodes.set(exportedName, node);
          } else {
            allDeclarations.set(exportedName, true);
          }
        }
      }

      if (node.moduleSpecifier) {
        // Handle re-exports
        const exportPath = (node.moduleSpecifier as ts.StringLiteral).text;
        const isLocalExport =
          exportPath.startsWith(".") || exportPath.startsWith("@/");

        if (isLocalExport) {
          let exportFile = exportPath;
          if (exportPath.startsWith("@/")) {
            exportFile = exportPath.replace("@/", "/src/");
            if (!exportPath.endsWith(".ts") && !exportPath.endsWith(".tsx")) {
              exportFile = `${exportFile}.ts`;
            }
          } else if (exportPath.startsWith(".")) {
            if (!exportPath.endsWith(".ts") && !exportPath.endsWith(".tsx")) {
              const basePath = resolveToProjectPath(exportPath, filePath);
              exportFile = `${basePath}.ts`; // Always default to .ts
            } else {
              exportFile = resolveToProjectPath(exportPath, filePath);
            }
          }

          // For re-exports, we create an empty set since it re-exports everything
          const exportedDeclarations = new Set<string>();
          if (node.exportClause && ts.isNamedExports(node.exportClause)) {
            for (const element of node.exportClause.elements) {
              exportedDeclarations.add(element.name.text);
            }
          }
          // If no named exports (export *), we keep the empty set
          importsByFile.set(exportFile, exportedDeclarations);
        } else {
          // Handle external re-exports similar to imports
          const importedDeclarations: string[] = [];
          if (node.exportClause && ts.isNamedExports(node.exportClause)) {
            for (const element of node.exportClause.elements) {
              importedDeclarations.push(element.name.text);
            }
          }
          externalDeps.add(
            JSON.stringify({
              importPath: exportPath,
              declarations: importedDeclarations,
            }),
          );
        }
      }
    }
    ts.forEachChild(node, collectImports);
  }

  function collectExports(node: ts.Node) {
    // Handle export const/let/var declarations
    if (ts.isVariableStatement(node)) {
      const isExported = hasExportModifier(node);
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) {
          if (isExported) {
            allDeclarations.set(decl.name.text, true);
          }
          declarationNodes.set(decl.name.text, decl);
        } else if (ts.isObjectBindingPattern(decl.name) && isExported) {
          // Handle destructured exports
          for (const element of decl.name.elements) {
            if (ts.isIdentifier(element.name)) {
              allDeclarations.set(element.name.text, true);
              declarationNodes.set(element.name.text, node);
            }
          }
        } else if (ts.isArrayBindingPattern(decl.name) && isExported) {
          // Handle array destructured exports
          for (const element of decl.name.elements) {
            if (ts.isBindingElement(element) && ts.isIdentifier(element.name)) {
              allDeclarations.set(element.name.text, true);
              declarationNodes.set(element.name.text, node);
            }
          }
        }
      }
    } else if (ts.isExportDeclaration(node)) {
      // Handle named exports and re-exports
      if (node.exportClause) {
        if (ts.isNamedExports(node.exportClause)) {
          for (const element of node.exportClause.elements) {
            const exportedName = element.name.text;
            const propertyName = element.propertyName?.text;

            // If this is an aliased export (like 'handler as GET')
            if (
              propertyName &&
              HTTP_METHODS.includes(
                exportedName as (typeof HTTP_METHODS)[number],
              )
            ) {
              // Store both the original name and the alias
              allDeclarations.set(exportedName, true);
              declarationNodes.set(exportedName, node);
            } else {
              allDeclarations.set(exportedName, true);
              if (propertyName) {
                // For aliased exports, store the original name as well
                allDeclarations.set(propertyName, true);
              }
            }
          }
        } else if (ts.isNamespaceExport(node.exportClause)) {
          // Handle 'export * as name from "module"'
          allDeclarations.set(node.exportClause.name.text, true);
          declarationNodes.set(node.exportClause.name.text, node);
        }
      } else if (node.moduleSpecifier) {
        // Handle 'export * from "module"'
        // This is handled in the importsByFile/externalDeps logic
      }

      if (node.moduleSpecifier) {
        // Handle re-exports (already implemented)
        // ... existing re-export handling code ...
      }
    } else if (ts.isExportAssignment(node)) {
      // Handle export default and export =
      if (ts.isIdentifier(node.expression)) {
        // If default export references an existing declaration, just track that
        allDeclarations.set(node.expression.text, true);
        declarationNodes.set(node.expression.text, node);
      } else {
        // Only track anonymous default exports
        const defaultName = "default";
        allDeclarations.set(defaultName, true);
        declarationNodes.set(defaultName, node);
      }
    } else if (
      ts.isFunctionDeclaration(node) ||
      ts.isClassDeclaration(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isTypeAliasDeclaration(node) ||
      ts.isEnumDeclaration(node)
    ) {
      const isExported = hasExportModifier(node);
      const isDefaultExport = node.modifiers?.some(
        (mod) => mod.kind === ts.SyntaxKind.DefaultKeyword,
      );

      if (node.name) {
        // For named declarations, always track by their actual name
        if (isExported || isDefaultExport) {
          allDeclarations.set(node.name.text, true);
          declarationNodes.set(node.name.text, node);
        }
      } else if (isDefaultExport) {
        // Only track anonymous default exports as "default"
        allDeclarations.set("default", true);
        declarationNodes.set("default", node);
      }
    }

    // Handle const/let/var declarations that might be exported later
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) {
          declarationNodes.set(decl.name.text, decl);
        }
      }
    }

    ts.forEachChild(node, collectExports);
  }

  // First collect all imports and exports
  ts.forEachChild(sourceFile, collectImports);
  ts.forEachChild(sourceFile, collectExports);

  // Then process declarations
  ts.forEachChild(sourceFile, processNode);

  // Process any declarations that were marked as exported but not yet processed
  for (const [name, isExported] of allDeclarations.entries()) {
    if (isExported && !(name in declarations)) {
      const node = declarationNodes.get(name);
      if (node) {
        processDeclaration(name, node, true);
      }
    }
  }

  // If no declarations were found but we have dependencies (like in re-export files or files with bare imports)
  if (
    Object.keys(declarations).length === 0 &&
    (importsByFile.size > 0 || externalDeps.size > 0)
  ) {
    declarations.default = [
      ...Array.from(importsByFile.entries()).map(([file]) => ({
        type: "internal" as const,
        from: file,
        dependsOn: [],
      })),
      ...Array.from(externalDeps).map((dep) => {
        const parsed = JSON.parse(dep) as {
          importPath: string;
          declarations: string[];
        };
        return {
          type: "external" as const,
          from: parsed.importPath,
          dependsOn: parsed.declarations,
          name: extractPackageName(parsed.importPath),
        };
      }),
    ];
  }

  return declarations;
}

// Test function to run example cases
async function main() {
  // Test case 1: Simple TypeScript file with imports and exports
  const simpleFileContent = `
    import { useState } from 'react';
    import { z } from 'zod';
    import { MyComponent } from './MyComponent';

    export const add = (a: number, b: number) => a + b;
    export const multiply = (a: number, b: number) => a * b;

    export interface User {
      id: string;
      name: string;
    }
  `;

  // Test case 2: API route file
  const apiRouteContent = `
    import { NextResponse } from 'next/server';
    import { db } from '@/server/db';
    import { auth } from '@/lib/auth';

    export async function GET(request: Request) {
      const users = await db.user.findMany();
      return NextResponse.json({ users });
    }

    export async function POST(request: Request) {
      const data = await request.json();
      const user = await db.user.create({ data });
      return NextResponse.json(user);
    }
  `;

  // Test case 3: Schema file with relations
  const schemaFileContent = `
    import { relations } from 'drizzle-orm';
    import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

    export const users = pgTable('users', {
      id: text('id').primaryKey(),
      name: text('name').notNull(),
      createdAt: timestamp('created_at').defaultNow(),
    });

    export const usersRelations = relations(users, ({ many }) => ({
      posts: many(posts),
    }));
  `;

  // Test case 4: RPC router file
  const rpcFileContent = `
    import { z } from 'zod';
    import { publicProcedure, router } from '../trpc';

    export const userRouter = router({
      list: publicProcedure
        .query(async ({ ctx }) => {
          return ctx.db.user.findMany();
        }),
      create: publicProcedure
        .input(z.object({ name: z.string() }))
        .mutation(async ({ ctx, input }) => {
          return ctx.db.user.create({ data: input });
        }),
    });
  `;

  // Test case 5: File changes comparison
  const oldContent = `
    import { z } from 'zod';
    import { db } from '@/server/db';

    export const getUser = async (id: string) => {
      return db.user.findUnique({ where: { id } });
    };

    export const createUser = async (data: { name: string }) => {
      return db.user.create({ data });
    };

    export interface UserResponse {
      id: string;
      name: string;
    }
  `;

  // Test case 6: API route file with HTTP method aliases
  const apiRouteContentWithAliases = `
    import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
    import type { NextRequest } from "next/server";

    import { appRouter } from "@/server/api/root";
    import { createTRPCContext } from "@/server/api/trpc";

    const createContext = async (req: NextRequest) => {
      return createTRPCContext({
        headers: req.headers,
      });
    };

    const handler = (req: NextRequest) =>
      fetchRequestHandler({
        endpoint: "/api/trpc",
        req,
        router: appRouter,
        createContext: () => createContext(req),
        onError:
          process.env.NODE_ENV === "development"
            ? ({ path, error }) => {
                console.error(
                  "❌ tRPC failed",
                );
              }
            : undefined,
      });

    export { handler as GET, handler as POST };
  `;

  // Test case 7: API route file
  const destructuredApiRoute = `
    import { auth } from "@/lib/auth";
    import { toNextJsHandler } from "better-auth/next-js";
    export const { GET, POST } = toNextJsHandler(auth);
  `;

  const newContent = `
    import { z } from 'zod';
    import { db } from '@/server/db';
    import { logger } from '@/lib/logger';

    export const getUser = async (id: string) => {
      logger.info('Fetching user', { id });
      return db.user.findUnique({ where: { id } });
    };

    export const updateUser = async (id: string, data: { name: string }) => {
      return db.user.update({ where: { id }, data });
    };

    export interface UserResponse {
      id: string;
      name: string;
      updatedAt: Date;
    }
  `;

  console.log("\n=== Test Case 1: Simple TypeScript File ===");
  console.log(
    JSON.stringify(
      processDeclarations({
        fileContent: simpleFileContent,
        filePath: "/src/utils/math.ts",
      }),
      null,
      2,
    ),
  );

  console.log("\n=== Test Case 2: API Route File ===");
  console.log(
    JSON.stringify(
      processDeclarations({
        fileContent: apiRouteContent,
        filePath: "/src/app/api/users/route.ts",
      }),
      null,
      2,
    ),
  );

  console.log("\n=== Test Case 3: Schema File ===");
  console.log(
    JSON.stringify(
      processDeclarations({
        fileContent: schemaFileContent,
        filePath: "/src/server/db/schema/user.ts",
      }),
      null,
      2,
    ),
  );

  console.log("\n=== Test Case 4: RPC Router File ===");
  console.log(
    JSON.stringify(
      processDeclarations({
        fileContent: rpcFileContent,
        filePath: "/src/server/api/routers/user.ts",
      }),
      null,
      2,
    ),
  );

  console.log("\n=== Test Case 5: File Changes Comparison ===");
  console.log(
    JSON.stringify(
      processDeclarations({
        fileContent: newContent,
        filePath: "/src/server/services/user.ts",
        previousContent: oldContent,
      }),
      null,
      2,
    ),
  );

  console.log("\n=== Test Case 6: API Route with aliases ===");
  console.log(
    JSON.stringify(
      processDeclarations({
        fileContent: apiRouteContentWithAliases,
        filePath: "/src/app/api/trpc/[trpc]/route.ts",
      }),
      null,
      2,
    ),
  );

  console.log("\n=== Test Case 7: API Route with destructured exports ===");
  console.log(
    JSON.stringify(
      processDeclarations({
        fileContent: destructuredApiRoute,
        filePath: "/src/app/api/auth/[...all]/route.ts",
      }),
      null,
      2,
    ),
  );
}

// Run the tests if this file is being executed directly
if (require.main === module) {
  main().catch(console.error);
}
