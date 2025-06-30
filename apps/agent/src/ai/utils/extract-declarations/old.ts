import { parseSync } from "@swc/core";
import type {
  ClassDeclaration,
  Declaration,
  ExportDeclaration,
  ExportDefaultDeclaration,
  ExportNamedDeclaration,
  FunctionDeclaration,
  ImportDeclaration,
  ModuleItem,
  Span,
  TsEnumDeclaration,
  TsInterfaceDeclaration,
  TsModuleDeclaration,
  TsTypeAliasDeclaration,
  VariableDeclaration,
} from "@swc/types";

export interface DeclarationPosition {
  start: { line: number; column: number };
  end: { line: number; column: number };
}

export interface ExternalDependency {
  type: "external";
  packageName: string;
  importPath: string;
  dependsOn: string[];
}

export interface InternalDependency {
  type: "internal";
  filePath: string;
  dependsOn: string[];
}

export type Dependency = ExternalDependency | InternalDependency;

export interface ExtractedDeclaration {
  name: string;
  type:
    | "function"
    | "class"
    | "interface"
    | "type"
    | "const"
    | "let"
    | "var"
    | "enum"
    | "namespace";
  isExported: boolean;
  position: DeclarationPosition;
  dependencies: Dependency[];
  uri: string;
}

export function extractDeclarations({
  sourceCode,
  filename = "input.ts",
  includeNonExported = false,
  projectRoot,
  pathAliases,
}: {
  sourceCode: string;
  filename?: string;
  includeNonExported?: boolean;
  projectRoot: string;
  pathAliases?: Record<string, string>;
}): ExtractedDeclaration[] {
  try {
    const ast = parseSync(sourceCode, {
      syntax: "typescript",
      tsx: filename.endsWith(".tsx"),
      decorators: true,
    });

    const declarations: ExtractedDeclaration[] = [];
    const sourceLines = sourceCode.split("\n");

    // Track imported identifiers for dependency analysis
    const importedIdentifiers = new Map<
      string,
      { source: string; isExternal: boolean }
    >();

    for (const item of ast.body) {
      if (item.type === "ImportDeclaration") {
        // Track imports for dependency analysis
        const importDecl = item as ImportDeclaration;
        const source = importDecl.source.value;
        const isExternal = isExternalPackage({
          importPath: source,
          pathAliases,
        });
        const resolvedSource = isExternal
          ? source
          : resolveInternalPath({
              importPath: source,
              currentFilePath: filename,
              pathAliases,
            });

        for (const specifier of importDecl.specifiers) {
          if (specifier.type === "ImportDefaultSpecifier") {
            importedIdentifiers.set(specifier.local.value, {
              source: resolvedSource,
              isExternal,
            });
          } else if (specifier.type === "ImportSpecifier") {
            importedIdentifiers.set(specifier.local.value, {
              source: resolvedSource,
              isExternal,
            });
          } else if (specifier.type === "ImportNamespaceSpecifier") {
            importedIdentifiers.set(specifier.local.value, {
              source: resolvedSource,
              isExternal,
            });
          }
        }
      }

      // Handle export declarations
      if (item.type === "ExportDeclaration") {
        const exportDecl = item as ExportDeclaration;
        // Check if this is a namespace declaration that returns multiple items
        if (exportDecl.declaration.type === "TsModuleDeclaration") {
          const extractedList = extractFromModuleItem({
            item: exportDecl.declaration as ModuleItem,
            sourceLines,
            isExported: true,
            filename,
            projectRoot,
            importedIdentifiers,
          });
          for (const extracted of extractedList) {
            const raw = extractRawCode(
              exportDecl.declaration.span,
              sourceLines,
            );
            extracted.dependencies = findDependencies({
              code: raw,
              importedIdentifiers,
              projectRoot,
            });
            declarations.push(extracted);
          }
        } else {
          const extracted = extractFromDeclaration({
            declaration: exportDecl.declaration,
            sourceLines,
            isExported: true,
            filename,
            projectRoot,
          });
          if (extracted) {
            const raw = extractRawCode(
              exportDecl.declaration.span,
              sourceLines,
            );
            extracted.dependencies = findDependencies({
              code: raw,
              importedIdentifiers,
              projectRoot,
            });
            declarations.push(extracted);
          }
        }
      }

      // Handle export named declarations
      if (item.type === "ExportNamedDeclaration") {
        const exportNamedDecl = item as ExportNamedDeclaration;
        if ("declaration" in exportNamedDecl && exportNamedDecl.declaration) {
          const extractedList = extractFromModuleItem({
            item: exportNamedDecl.declaration as ModuleItem,
            sourceLines,
            isExported: true,
            filename,
            projectRoot,
            importedIdentifiers,
          });
          for (const extracted of extractedList) {
            const raw = extractRawCode(
              (exportNamedDecl.declaration as ModuleItem).span,
              sourceLines,
            );
            extracted.dependencies = findDependencies({
              code: raw,
              importedIdentifiers,
              projectRoot,
            });
            declarations.push(extracted);
          }
        }
      }

      // Handle export default declarations
      if (item.type === "ExportDefaultDeclaration") {
        const exportDefaultDecl = item as ExportDefaultDeclaration;
        const decl = exportDefaultDecl.decl;
        if (
          decl.type === "FunctionExpression" ||
          decl.type === "ClassExpression"
        ) {
          const position = spanToPosition({
            span: decl.span,
            sourceLines,
          });
          const raw = extractRawCode(decl.span, sourceLines);

          declarations.push({
            name: decl.identifier?.value || "default",
            type: decl.type === "FunctionExpression" ? "function" : "class",
            isExported: true,
            position,
            dependencies: findDependencies({
              code: raw,
              importedIdentifiers,
              projectRoot,
            }),
            uri: generateDeclarationUri({
              filename,
              name: decl.identifier?.value || "default",
              projectRoot,
            }),
          });
        }
      }

      // Handle regular declarations if includeNonExported is true
      if (includeNonExported) {
        const extractedList = extractFromModuleItem({
          item,
          sourceLines,
          isExported: false,
          filename,
          projectRoot,
          importedIdentifiers,
        });
        for (const extracted of extractedList) {
          const raw = extractRawCode(item.span, sourceLines);
          extracted.dependencies = findDependencies({
            code: raw,
            importedIdentifiers,
            projectRoot,
          });
          declarations.push(extracted);
        }
      }
    }

    return declarations;
  } catch (error) {
    throw new Error(
      `Failed to parse TypeScript code: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

function generateDeclarationUri({
  filename,
  name,
  projectRoot,
}: {
  filename: string;
  name: string;
  projectRoot: string;
}): string {
  let normalizedFile = filename.replace(/\\/g, "/");

  // Make path relative to project root using string manipulation
  if (projectRoot && normalizedFile.startsWith(projectRoot)) {
    normalizedFile = normalizedFile.substring(projectRoot.length);
    // Remove leading slash if present
    if (normalizedFile.startsWith("/")) {
      normalizedFile = normalizedFile.substring(1);
    }
  }

  return `${normalizedFile}#${name}`;
}

function isExternalPackage({
  importPath,
  pathAliases,
}: {
  importPath: string;
  pathAliases?: Record<string, string>;
}): boolean {
  // If it starts with . or /, it's definitely internal
  if (importPath.startsWith(".") || importPath.startsWith("/")) {
    return false;
  }

  // Check if it matches any path alias - if so, it's internal
  if (pathAliases) {
    for (const alias of Object.keys(pathAliases)) {
      // Handle glob patterns like "@/*"
      if (alias.endsWith("/*")) {
        const aliasPrefix = alias.slice(0, -2); // Remove "/*"
        if (importPath.startsWith(`${aliasPrefix}/`)) {
          return false; // It's internal via alias
        }
      }
      // Handle exact matches
      else if (importPath === alias) {
        return false; // It's internal via alias
      }
    }
  }

  // If none of the above, it's external
  return true;
}

function resolvePathAlias({
  importPath,
  pathAliases,
}: {
  importPath: string;
  pathAliases?: Record<string, string>;
}): string | null {
  if (!pathAliases) return null;

  for (const [alias, target] of Object.entries(pathAliases)) {
    // Handle glob patterns like "@/*" -> "./src/*"
    if (alias.endsWith("/*") && target.endsWith("/*")) {
      const aliasPrefix = alias.slice(0, -2); // Remove "/*"
      const targetPrefix = target.slice(0, -2); // Remove "/*"

      if (importPath.startsWith(`${aliasPrefix}/`)) {
        const remainingPath = importPath.slice(aliasPrefix.length + 1);
        return `${targetPrefix}/${remainingPath}`;
      }
    }
    // Handle exact matches
    else if (importPath === alias) {
      return target;
    }
  }

  return null;
}

function resolveInternalPath({
  importPath,
  currentFilePath,
  pathAliases,
}: {
  importPath: string;
  currentFilePath: string;
  pathAliases?: Record<string, string>;
}): string {
  // First try to resolve using path aliases
  const aliasResolved = resolvePathAlias({ importPath, pathAliases });
  if (aliasResolved) {
    // Path aliases should resolve to project-relative paths
    return aliasResolved;
  }

  // For relative imports, resolve them relative to current file
  if (importPath.startsWith(".")) {
    return resolveRelativePath(currentFilePath, importPath);
  }

  // Return as-is for other cases
  return importPath;
}

function resolveRelativePath(
  currentFilePath: string,
  importPath: string,
): string {
  // Pure string-based path resolution without filesystem dependencies
  const currentDir = currentFilePath.includes("/")
    ? currentFilePath.substring(0, currentFilePath.lastIndexOf("/"))
    : "";

  if (importPath === ".") {
    return currentDir || ".";
  }

  if (importPath === "..") {
    if (!currentDir) return "..";
    const parentDir = currentDir.includes("/")
      ? currentDir.substring(0, currentDir.lastIndexOf("/"))
      : "";
    return parentDir || ".";
  }

  if (importPath.startsWith("./")) {
    const relativePart = importPath.substring(2);
    return currentDir ? `${currentDir}/${relativePart}` : relativePart;
  }

  if (importPath.startsWith("../")) {
    const segments = importPath.split("/");
    let targetDir = currentDir;
    let i = 0;

    // Process all '../' segments
    while (i < segments.length && segments[i] === "..") {
      if (targetDir?.includes("/")) {
        targetDir = targetDir.substring(0, targetDir.lastIndexOf("/"));
      } else {
        targetDir = "..";
      }
      i++;
    }

    // Add remaining path segments
    const remainingPath = segments.slice(i).join("/");
    if (!remainingPath) return targetDir || ".";

    return targetDir ? `${targetDir}/${remainingPath}` : remainingPath;
  }

  // For other cases, just combine with current directory
  return currentDir ? `${currentDir}/${importPath}` : importPath;
}

function extractFromModuleItem({
  item,
  sourceLines,
  isExported,
  filename,
  projectRoot,
  importedIdentifiers,
}: {
  item: ModuleItem;
  sourceLines: string[];
  isExported: boolean;
  filename: string;
  projectRoot: string;
  importedIdentifiers?: Map<string, { source: string; isExternal: boolean }>;
}): ExtractedDeclaration[] {
  switch (item.type) {
    case "VariableDeclaration": {
      const result = extractFromVariableDeclaration({
        decl: item as VariableDeclaration,
        sourceLines,
        isExported,
        filename,
        projectRoot,
      });
      return result ? [result] : [];
    }
    case "FunctionDeclaration": {
      const result = extractFromFunctionDeclaration({
        decl: item as FunctionDeclaration,
        sourceLines,
        isExported,
        filename,
        projectRoot,
      });
      return result ? [result] : [];
    }
    case "ClassDeclaration": {
      const result = extractFromClassDeclaration({
        decl: item as ClassDeclaration,
        sourceLines,
        isExported,
        filename,
        projectRoot,
      });
      return result ? [result] : [];
    }
    case "TsInterfaceDeclaration": {
      const result = extractFromInterfaceDeclaration({
        decl: item as TsInterfaceDeclaration,
        sourceLines,
        isExported,
        filename,
        projectRoot,
      });
      return result ? [result] : [];
    }
    case "TsTypeAliasDeclaration": {
      const result = extractFromTypeAliasDeclaration({
        decl: item as TsTypeAliasDeclaration,
        sourceLines,
        isExported,
        filename,
        projectRoot,
      });
      return result ? [result] : [];
    }
    case "TsEnumDeclaration": {
      const result = extractFromEnumDeclaration({
        decl: item as TsEnumDeclaration,
        sourceLines,
        isExported,
        filename,
        projectRoot,
      });
      return result ? [result] : [];
    }
    case "TsModuleDeclaration":
      return extractFromModuleDeclaration({
        decl: item as TsModuleDeclaration,
        sourceLines,
        isExported,
        filename,
        projectRoot,
        importedIdentifiers,
      });
    default:
      return [];
  }
}

function extractFromDeclaration({
  declaration,
  sourceLines,
  isExported,
  filename,
  projectRoot,
}: {
  declaration: Declaration;
  sourceLines: string[];
  isExported: boolean;
  filename: string;
  projectRoot: string;
}): ExtractedDeclaration | null {
  const results = extractFromModuleItem({
    item: declaration as ModuleItem,
    sourceLines,
    isExported,
    filename,
    projectRoot,
    importedIdentifiers: undefined,
  });
  return results[0] || null;
}

function extractFromVariableDeclaration({
  decl,
  sourceLines,
  isExported,
  filename,
  projectRoot,
}: {
  decl: VariableDeclaration;
  sourceLines: string[];
  isExported: boolean;
  filename: string;
  projectRoot: string;
}): ExtractedDeclaration | null {
  const declarator = decl.declarations[0];
  if (!declarator?.id || declarator.id.type !== "Identifier") return null;

  const position = spanToPosition({
    span: decl.span,
    sourceLines,
  });
  const name = declarator.id.value;

  return {
    name,
    type: decl.kind,
    isExported,
    position,
    dependencies: [],
    uri: generateDeclarationUri({
      filename,
      name,
      projectRoot,
    }),
  };
}

function extractFromFunctionDeclaration({
  decl,
  sourceLines,
  isExported,
  filename,
  projectRoot,
}: {
  decl: FunctionDeclaration;
  sourceLines: string[];
  isExported: boolean;
  filename: string;
  projectRoot: string;
}): ExtractedDeclaration | null {
  if (!decl.identifier) return null;

  const position = spanToPosition({
    span: decl.span,
    sourceLines,
  });
  const name = decl.identifier.value;

  return {
    name,
    type: "function",
    isExported,
    position,
    dependencies: [],
    uri: generateDeclarationUri({
      filename,
      name,
      projectRoot,
    }),
  };
}

function extractFromClassDeclaration({
  decl,
  sourceLines,
  isExported,
  filename,
  projectRoot,
}: {
  decl: ClassDeclaration;
  sourceLines: string[];
  isExported: boolean;
  filename: string;
  projectRoot: string;
}): ExtractedDeclaration | null {
  if (!decl.identifier) return null;

  const position = spanToPosition({
    span: decl.span,
    sourceLines,
  });
  const name = decl.identifier.value;

  return {
    name,
    type: "class",
    isExported,
    position,
    dependencies: [],
    uri: generateDeclarationUri({
      filename,
      name,
      projectRoot,
    }),
  };
}

function extractFromInterfaceDeclaration({
  decl,
  sourceLines,
  isExported,
  filename,
  projectRoot,
}: {
  decl: TsInterfaceDeclaration;
  sourceLines: string[];
  isExported: boolean;
  filename: string;
  projectRoot: string;
}): ExtractedDeclaration | null {
  const position = spanToPosition({
    span: decl.span,
    sourceLines,
  });
  const name = decl.id.value;

  return {
    name,
    type: "interface",
    isExported,
    position,
    dependencies: [],
    uri: generateDeclarationUri({
      filename,
      name,
      projectRoot,
    }),
  };
}

function extractFromTypeAliasDeclaration({
  decl,
  sourceLines,
  isExported,
  filename,
  projectRoot,
}: {
  decl: TsTypeAliasDeclaration;
  sourceLines: string[];
  isExported: boolean;
  filename: string;
  projectRoot: string;
}): ExtractedDeclaration | null {
  const position = spanToPosition({
    span: decl.span,
    sourceLines,
  });
  const name = decl.id.value;

  return {
    name,
    type: "type",
    isExported,
    position,
    dependencies: [],
    uri: generateDeclarationUri({
      filename,
      name,
      projectRoot,
    }),
  };
}

function extractFromEnumDeclaration({
  decl,
  sourceLines,
  isExported,
  filename,
  projectRoot,
}: {
  decl: TsEnumDeclaration;
  sourceLines: string[];
  isExported: boolean;
  filename: string;
  projectRoot: string;
}): ExtractedDeclaration | null {
  const position = spanToPosition({
    span: decl.span,
    sourceLines,
  });
  const name = decl.id.value;

  return {
    name,
    type: "enum",
    isExported,
    position,
    dependencies: [],
    uri: generateDeclarationUri({
      filename,
      name,
      projectRoot,
    }),
  };
}

function extractFromModuleDeclaration({
  decl,
  sourceLines,
  isExported,
  filename,
  projectRoot,
  importedIdentifiers,
}: {
  decl: TsModuleDeclaration;
  sourceLines: string[];
  isExported: boolean;
  filename: string;
  projectRoot: string;
  importedIdentifiers?: Map<string, { source: string; isExternal: boolean }>;
}): ExtractedDeclaration[] {
  const position = spanToPosition({
    span: decl.span,
    sourceLines,
  });
  const namespaceName =
    decl.id.type === "Identifier" ? decl.id.value : "unknown";

  const declarations: ExtractedDeclaration[] = [];

  // Add the namespace itself
  declarations.push({
    name: namespaceName,
    type: "namespace",
    isExported,
    position,
    dependencies: [],
    uri: generateDeclarationUri({
      filename,
      name: namespaceName,
      projectRoot,
    }),
  });

  // Extract members from namespace body
  if (decl.body && decl.body.type === "TsModuleBlock") {
    for (const item of decl.body.body) {
      // Handle both export declarations and regular declarations inside namespace
      if (item.type === "ExportDeclaration") {
        const exportDecl = item as ExportDeclaration;
        const extracted = extractFromDeclaration({
          declaration: exportDecl.declaration,
          sourceLines,
          isExported: true,
          filename,
          projectRoot,
        });
        if (extracted) {
          // Prefix with namespace name
          extracted.name = `${namespaceName}.${extracted.name}`;
          // Regenerate URI with the prefixed name
          extracted.uri = generateDeclarationUri({
            filename,
            name: extracted.name,
            projectRoot,
          });
          const raw = extractRawCode(exportDecl.declaration.span, sourceLines);
          extracted.dependencies = findDependencies({
            code: raw,
            importedIdentifiers: importedIdentifiers || new Map(),
            projectRoot,
          });
          declarations.push(extracted);
        }
      } else {
        // Handle regular declarations inside namespace (they are implicitly exported)
        const extractedList = extractFromModuleItem({
          item,
          sourceLines,
          isExported: true,
          filename,
          projectRoot,
          importedIdentifiers,
        });
        for (const extracted of extractedList) {
          // Prefix with namespace name
          extracted.name = `${namespaceName}.${extracted.name}`;
          // Regenerate URI with the prefixed name
          extracted.uri = generateDeclarationUri({
            filename,
            name: extracted.name,
            projectRoot,
          });
          const raw = extractRawCode(item.span, sourceLines);
          extracted.dependencies = findDependencies({
            code: raw,
            importedIdentifiers: importedIdentifiers || new Map(),
            projectRoot,
          });
          declarations.push(extracted);
        }
      }
    }
  }

  return declarations;
}

function spanToPosition({
  span,
  sourceLines,
}: {
  span: Span;
  sourceLines: string[];
}): DeclarationPosition {
  const startLine = getLineFromByteOffset(span.start, sourceLines);
  const endLine = getLineFromByteOffset(span.end, sourceLines);
  const startColumn = getColumnFromByteOffset(
    span.start,
    sourceLines,
    startLine,
  );
  const endColumn = getColumnFromByteOffset(span.end, sourceLines, endLine);

  return {
    start: { line: startLine, column: startColumn },
    end: { line: endLine, column: endColumn },
  };
}

function getLineFromByteOffset(
  byteOffset: number,
  sourceLines: string[],
): number {
  let currentOffset = 0;
  for (let i = 0; i < sourceLines.length; i++) {
    const line = sourceLines[i];
    if (!line) continue;
    const lineLength = line.length + 1; // +1 for newline
    if (currentOffset + lineLength > byteOffset) {
      return i + 1; // 1-based line numbers
    }
    currentOffset += lineLength;
  }
  return sourceLines.length;
}

function getColumnFromByteOffset(
  byteOffset: number,
  sourceLines: string[],
  line: number,
): number {
  let currentOffset = 0;
  for (let i = 0; i < line - 1; i++) {
    const sourceLine = sourceLines[i];
    if (sourceLine) {
      currentOffset += sourceLine.length + 1; // +1 for newline
    }
  }
  return byteOffset - currentOffset + 1; // 1-based column numbers
}

function extractRawCode(span: Span, sourceLines: string[]): string {
  const startLine = getLineFromByteOffset(span.start, sourceLines) - 1;
  const endLine = getLineFromByteOffset(span.end, sourceLines) - 1;
  const startCol =
    getColumnFromByteOffset(span.start, sourceLines, startLine + 1) - 1;
  const endCol =
    getColumnFromByteOffset(span.end, sourceLines, endLine + 1) - 1;

  if (startLine === endLine) {
    const line = sourceLines[startLine];
    return line ? line.slice(startCol, endCol) : "";
  }

  const lines: string[] = [];
  const firstLine = sourceLines[startLine];
  if (firstLine) {
    lines.push(firstLine.slice(startCol));
  }

  for (let i = startLine + 1; i < endLine; i++) {
    const line = sourceLines[i];
    if (line) {
      lines.push(line);
    }
  }

  if (endLine < sourceLines.length) {
    const lastLine = sourceLines[endLine];
    if (lastLine) {
      lines.push(lastLine.slice(0, endCol));
    }
  }

  return lines.join("\n");
}

function findDependencies({
  code,
  importedIdentifiers,
  projectRoot,
}: {
  code: string;
  importedIdentifiers: Map<string, { source: string; isExternal: boolean }>;
  projectRoot?: string;
}): Dependency[] {
  const dependenciesMap = new Map<
    string,
    {
      isExternal: boolean;
      source: string;
      identifiers: Set<string>;
    }
  >();
  const identifierRegex = /\b[a-zA-Z_$][a-zA-Z0-9_$]*\b/g;
  const matches = code.match(identifierRegex) || [];

  for (const match of matches) {
    const importInfo = importedIdentifiers.get(match);
    if (importInfo) {
      if (!dependenciesMap.has(importInfo.source)) {
        dependenciesMap.set(importInfo.source, {
          isExternal: importInfo.isExternal,
          source: importInfo.source,
          identifiers: new Set<string>(),
        });
      }
      dependenciesMap.get(importInfo.source)?.identifiers.add(match);
    }
  }

  const dependencies: Dependency[] = [];
  for (const [_, depInfo] of dependenciesMap.entries()) {
    if (depInfo.isExternal) {
      // For external packages, extract package name from import path
      const packageName = depInfo.source.split("/")[0] || depInfo.source;
      dependencies.push({
        type: "external",
        packageName,
        importPath: depInfo.source,
        dependsOn: Array.from(depInfo.identifiers),
      });
    } else {
      // For internal dependencies, use the resolved path as-is
      let filePath = depInfo.source;

      // Normalize the path to be project-relative
      if (projectRoot && filePath.startsWith(projectRoot)) {
        filePath = filePath.substring(projectRoot.length);
        // Remove leading slash if present
        if (filePath.startsWith("/")) {
          filePath = filePath.substring(1);
        }
      }

      // Ensure it starts with ./ for relative paths (unless it's already relative with ../)
      if (
        filePath &&
        !filePath.startsWith("./") &&
        !filePath.startsWith("../") &&
        !filePath.startsWith("/")
      ) {
        filePath = `./${filePath}`;
      }

      dependencies.push({
        type: "internal",
        filePath,
        dependsOn: Array.from(depInfo.identifiers),
      });
    }
  }

  return dependencies;
}

async function main() {
  const projectRoot = "/Users/user/project"; // Mock project root
  const pathAliases = {
    "@/": "src/",
    "~modules/": "src/modules/",
  };

  const testCases = [
    {
      name: "Basic Exports",
      filename: "src/basic.ts",
      includeNonExported: false,
      sourceCode: `
        export const myConst = 123;
        export let myLet = "hello";
        export function myFunction() { return "world"; }
        export class MyClass {
            public prop: string = "test";
            private id: number = 1;
            constructor(id: number) { this.id = id; }
            public getId(): number { return this.id; }
            private utility() {}
        }
        export type MyType = { a: string };
        export interface MyInterface { b: number; }
        export enum MyEnum { A, B }
        export namespace MyNamespace { export const a = 1; }
      `,
    },
    {
      name: "Default Exports",
      filename: "src/defaults.ts",
      includeNonExported: true,
      sourceCode: `
        export default function myDefaultFunction() {}
        const name = 'world';
        export default name;
        export default class MyDefaultClass {
            public name: string;
            constructor(name: string) {
                this.name = name;
            }
            greet() {
                return \`Hello, \${this.name}\`;
            }
        }
        export default function() {} // Anonymous function
      `,
    },
    {
      name: "Re-exports",
      filename: "src/re-exports.ts",
      includeNonExported: false,
      sourceCode: `
          export { a, b as c } from './utils';
          export * from './another-util';
          export { type T } from './types';
          export { Button } from 'some-external-lib';
        `,
    },
    {
      name: "Imports and Dependencies",
      filename: "src/dependencies.ts",
      includeNonExported: true,
      sourceCode: `
            import { utilFunction, utilConst } from './utils';
            import type { AnotherType } from '@/types';
            import DefaultUtil from '~modules/default-util';
            import * as AllUtils from './all-utils';

            const internalConst = 'internal';

            export function usesDependencies(param: AnotherType) {
                console.log(utilConst, internalConst);
                return utilFunction(param);
            }

            export const usesDefault = DefaultUtil.do();

            export const usesNamespace = AllUtils.someFunc();
        `,
    },
    {
      name: "Non-exported declarations",
      filename: "src/non-exported.ts",
      includeNonExported: true,
      sourceCode: `
            const a = 1;
            function b() { return a; }
            export const c = b();
            type T = string;
            interface I { x: T; }
        `,
    },
    {
      name: "TSX Component",
      filename: "src/component.tsx",
      includeNonExported: true,
      sourceCode: `
            import React, { useState } from 'react';
            import { Button } from '@/components/ui/button';

            interface MyComponentProps {
                title: string;
            }

            export const MyComponent = ({ title }: MyComponentProps) => {
                const [count, setCount] = useState(0);
                return (
                    <div>
                        <h1>{title}</h1>
                        <p>Count: {count}</p>
                        <Button onClick={() => setCount(c => c + 1)}>Increment</Button>
                    </div>
                );
            };

            export default MyComponent;
        `,
    },
    {
      name: "Complex Syntax",
      filename: "src/complex.ts",
      includeNonExported: true,
      sourceCode: `
            export const arrowFunc = (a: number): string => \`val: \${a}\`;
            export const { a, b: d } = { a: 1, b: 2 };
            export default function<T extends {id: string}>(arg: T): string {
                 return arg.id;
            }
            export const obj = {
                method() { return 'hello'; }
            }
        `,
    },
    {
      name: "Complex Real-world Example",
      filename: "src/user-service.ts",
      includeNonExported: true,
      sourceCode: `
            import { BaseService } from './base-service';
            import type { User, UserRole } from './types';

            export interface UserServiceConfig<T = any> {
              maxRetries?: number;
              timeout?: T;
            }

            export type UserStatus = 'active' | 'inactive' | 'pending';

            export async function* processUsers<T extends User>(
              users: T[],
              batchSize: number = 10
            ): AsyncGenerator<T[], void, unknown> {
              for (let i = 0; i < users.length; i += batchSize) {
                yield users.slice(i, i + batchSize);
              }
            }

            export class UserService<T extends User = User> extends BaseService implements UserServiceConfig {
              private readonly cache = new Map<string, T>();
              public static readonly DEFAULT_TIMEOUT = 5000;

              constructor(private config: UserServiceConfig<number>) {
                super();
              }

              async getUser(id: string): Promise<T | null> {
                return this.#cache.get(id) || null;
              }

              static async createService(): Promise<UserService> {
                return new UserService({ timeout: UserService.DEFAULT_TIMEOUT });
              }
            }

            export const userValidator = (user: User): boolean => user.id.length > 0;

            export { type UserRole as Role } from './types';
            export * from './user-utils';
      `,
    },
    {
      name: "Namespace",
      filename: "src/namespace.ts",
      sourceCode: `
        export namespace MyNamespace {
          export const a = 1;
          export function b() { return a; }
          export class C {
            public a: number;
            constructor(a: number) { this.a = a; }
            public getA() { return this.a; }
          }
          export type T = string;
        }
      `,
    },
  ];

  for (const [index, tc] of testCases.entries()) {
    console.log(`\n--- Test Case ${index + 1}: ${tc.name} ---\n`);
    console.log(`File: ${tc.filename}`);
    console.log("\n--- Output ---\n");

    try {
      const declarations = extractDeclarations({
        sourceCode: tc.sourceCode,
        filename: tc.filename,
        projectRoot,
        pathAliases,
        includeNonExported: tc.includeNonExported,
      });
      console.log(JSON.stringify(declarations, null, 2));
    } catch (error) {
      console.error(`Error in test case "${tc.name}":`, error);
    }
    console.log(`\n${"=".repeat(40)}`);
  }
}

// This allows the main function to be executed when the file is run directly
main().catch((err) => {
  console.error("Unhandled error in main function:", err);
  process.exit(1);
});
