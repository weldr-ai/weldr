import type {
  Declaration,
  ExportAllDeclaration,
  ExportDeclaration,
  ExportDefaultDeclaration,
  ExportNamedDeclaration,
  Identifier,
  ImportDeclaration,
  ModuleItem,
  NamedExportSpecifier,
} from "@swc/types";
import type { DeclarationData } from "@weldr/shared/types/declarations";
import {
  extractClassInfo,
  extractEnumInfo,
  extractFunctionInfo,
  extractInterfaceInfo,
  extractNamespaceInfo,
  extractRawCode,
  extractTypeAliasInfo,
  extractVariableInfo,
  spanToPosition,
} from "./ast-utils";
import { findDependencies } from "./dependencies";
import {
  generateDeclarationUri,
  isExternalPackage,
  resolveInternalPathAsync,
} from "./path-utils";

async function extractFromDeclaration({
  declaration,
  sourceLines,
  isExported,
  filename,
  projectRoot,
  importedIdentifiers,
  pathAliases,
}: {
  declaration: Declaration;
  sourceLines: string[];
  isExported: boolean;
  filename: string;
  projectRoot: string;
  importedIdentifiers: Map<string, { source: string; isExternal: boolean }>;
  pathAliases?: Record<string, string>;
}): Promise<DeclarationData | null> {
  const extractedList = await extractFromModuleItem({
    item: declaration as ModuleItem,
    sourceLines,
    isExported,
    filename,
    projectRoot,
    importedIdentifiers,
    pathAliases,
    // We pass the processor function down for recursive calls (e.g., in namespaces)
    processor: processModuleBody,
  });
  return extractedList[0] || null;
}

async function extractFromModuleItem({
  item,
  sourceLines,
  isExported,
  filename,
  projectRoot,
  importedIdentifiers,
  pathAliases,
  processor,
  namespacePrefix,
}: {
  item: ModuleItem;
  sourceLines: string[];
  isExported: boolean;
  filename: string;
  projectRoot: string;
  importedIdentifiers: Map<string, { source: string; isExternal: boolean }>;
  pathAliases?: Record<string, string>;
  processor: typeof processModuleBody;
  namespacePrefix?: string;
}): Promise<DeclarationData[]> {
  const declarations: DeclarationData[] = [];

  switch (item.type) {
    case "FunctionDeclaration": {
      const funcDecl = item;
      if (funcDecl.identifier) {
        const funcInfo = extractFunctionInfo(funcDecl);
        const name = funcDecl.identifier.value;
        const finalName = namespacePrefix ? `${namespacePrefix}.${name}` : name;
        declarations.push({
          name: finalName,
          type: "function",
          isExported,
          position: spanToPosition({ span: funcDecl.span, sourceLines }),
          dependencies: [], // Will be filled by caller
          uri: generateDeclarationUri({
            filename,
            name: finalName,
            projectRoot,
          }),
          ...funcInfo,
        });
      }
      break;
    }
    case "ClassDeclaration": {
      const classDecl = item;
      if (classDecl.identifier) {
        const classInfo = extractClassInfo(classDecl);
        const name = classDecl.identifier.value;
        const finalName = namespacePrefix ? `${namespacePrefix}.${name}` : name;
        declarations.push({
          name: finalName,
          type: "class",
          isExported,
          position: spanToPosition({ span: classDecl.span, sourceLines }),
          dependencies: [], // Will be filled by caller
          uri: generateDeclarationUri({
            filename,
            name: finalName,
            projectRoot,
          }),
          ...classInfo,
        });
      }
      break;
    }
    case "TsInterfaceDeclaration": {
      const interfaceDecl = item;
      const interfaceInfo = extractInterfaceInfo(interfaceDecl);
      const name = interfaceDecl.id.value;
      const finalName = namespacePrefix ? `${namespacePrefix}.${name}` : name;
      declarations.push({
        name: finalName,
        type: "interface",
        isExported,
        position: spanToPosition({ span: interfaceDecl.span, sourceLines }),
        dependencies: [], // Will be filled by caller
        uri: generateDeclarationUri({
          filename,
          name: finalName,
          projectRoot,
        }),
        ...interfaceInfo,
      });
      break;
    }
    case "TsTypeAliasDeclaration": {
      const typeAliasDecl = item;
      const typeAliasInfo = extractTypeAliasInfo(typeAliasDecl);
      const name = typeAliasDecl.id.value;
      const finalName = namespacePrefix ? `${namespacePrefix}.${name}` : name;
      declarations.push({
        name: finalName,
        type: "type",
        isExported,
        position: spanToPosition({ span: typeAliasDecl.span, sourceLines }),
        dependencies: [], // Will be filled by caller
        uri: generateDeclarationUri({
          filename,
          name: finalName,
          projectRoot,
        }),
        ...typeAliasInfo,
      });
      break;
    }
    case "TsEnumDeclaration": {
      const enumDecl = item;
      const enumInfo = extractEnumInfo(enumDecl, sourceLines);
      const name = enumDecl.id.value;
      const finalName = namespacePrefix ? `${namespacePrefix}.${name}` : name;
      declarations.push({
        name: finalName,
        type: "enum",
        isExported,
        position: spanToPosition({ span: enumDecl.span, sourceLines }),
        dependencies: [], // Will be filled by caller
        uri: generateDeclarationUri({
          filename,
          name: finalName,
          projectRoot,
        }),
        ...enumInfo,
      });
      break;
    }
    case "TsModuleDeclaration": {
      const moduleDecl = item;
      if (moduleDecl.id.type === "Identifier") {
        const localName = moduleDecl.id.value;
        const finalName = namespacePrefix
          ? `${namespacePrefix}.${localName}`
          : localName;
        const namespaceInfo = await extractNamespaceInfo(
          moduleDecl,
          sourceLines,
          filename,
          projectRoot,
          importedIdentifiers,
          pathAliases,
          // Pass the processor for recursive analysis
          processor,
          namespacePrefix || "",
        );
        declarations.push({
          name: localName,
          type: "namespace",
          isExported,
          position: spanToPosition({ span: moduleDecl.span, sourceLines }),
          dependencies: [], // Will be filled by caller
          uri: generateDeclarationUri({
            filename,
            name: finalName,
            projectRoot,
          }),
          ...namespaceInfo,
        });
      }
      break;
    }
    case "VariableDeclaration": {
      const varDecl = item;
      for (const declarator of varDecl.declarations) {
        if (declarator.id.type === "Identifier") {
          const varInfo = extractVariableInfo(declarator, varDecl.kind);
          const name = declarator.id.value;
          const finalName = namespacePrefix
            ? `${namespacePrefix}.${name}`
            : name;
          declarations.push({
            name: finalName,
            type: varDecl.kind as "const" | "let" | "var",
            isExported,
            position: spanToPosition({ span: varDecl.span, sourceLines }),
            dependencies: [], // Will be filled by caller
            uri: generateDeclarationUri({
              filename,
              name: finalName,
              projectRoot,
            }),
            ...varInfo,
          });
        }
      }
      break;
    }
  }

  return declarations;
}

function isExportRelated(item: ModuleItem): boolean {
  return (
    item.type === "ExportDeclaration" ||
    item.type === "ExportNamedDeclaration" ||
    item.type === "ExportDefaultDeclaration" ||
    item.type === "ExportAllDeclaration"
  );
}

export async function processModuleBody({
  body,
  sourceLines,
  filename,
  projectRoot,
  pathAliases,
  declarations,
  importedIdentifiers,
  namespacePrefix,
}: {
  body: ModuleItem[];
  sourceLines: string[];
  filename: string;
  projectRoot: string;
  pathAliases?: Record<string, string>;
  declarations: DeclarationData[];
  importedIdentifiers: Map<string, { source: string; isExternal: boolean }>;
  namespacePrefix?: string;
}): Promise<void> {
  for (const item of body) {
    if (item.type === "ImportDeclaration") {
      const importDecl = item as ImportDeclaration;
      const source = importDecl.source.value;
      const isExternal = isExternalPackage({ importPath: source, pathAliases });
      const resolvedSource = isExternal
        ? source
        : await resolveInternalPathAsync({
            importPath: source,
            currentFilePath: filename,
            pathAliases,
            projectRoot,
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

    if (item.type === "ExportDeclaration") {
      const exportDecl = item as ExportDeclaration;
      if (exportDecl.declaration) {
        if (exportDecl.declaration.type === "TsModuleDeclaration") {
          const extractedList = await extractFromModuleItem({
            item: exportDecl.declaration as ModuleItem,
            sourceLines,
            isExported: true,
            filename,
            projectRoot,
            importedIdentifiers,
            pathAliases,
            processor: processModuleBody,
            namespacePrefix,
          });
          for (const extracted of extractedList) {
            const raw = extractRawCode(
              exportDecl.declaration.span,
              sourceLines,
            );
            extracted.dependencies = findDependencies({
              code: raw,
              importedIdentifiers,
            });
            declarations.push(extracted);
          }
        } else {
          const extracted = await extractFromDeclaration({
            declaration: exportDecl.declaration,
            sourceLines,
            isExported: true,
            filename,
            projectRoot,
            importedIdentifiers,
            pathAliases,
          });
          if (extracted) {
            const raw = extractRawCode(
              exportDecl.declaration.span,
              sourceLines,
            );
            extracted.dependencies = findDependencies({
              code: raw,
              importedIdentifiers,
            });
            declarations.push(extracted);
          }
        }
      }
    }

    if (item.type === "ExportNamedDeclaration") {
      const exportNamedDecl = item as ExportNamedDeclaration;
      if (exportNamedDecl.source && exportNamedDecl.specifiers) {
        const source = exportNamedDecl.source.value;
        const isExternal = isExternalPackage({
          importPath: source,
          pathAliases,
        });
        const resolvedSource = isExternal
          ? source
          : await resolveInternalPathAsync({
              importPath: source,
              currentFilePath: filename,
              pathAliases,
              projectRoot,
            });

        for (const specifier of exportNamedDecl.specifiers) {
          if (specifier.type === "ExportSpecifier") {
            const exportSpec = specifier as NamedExportSpecifier;
            const originalName = (exportSpec.orig as Identifier).value;
            const exportedName =
              (exportSpec.exported as Identifier)?.value || originalName;

            declarations.push({
              name: exportedName,
              type: "const",
              isExported: true,
              isReExport: true,
              reExportSource: resolvedSource,
              position: spanToPosition({
                span: exportNamedDecl.span,
                sourceLines,
              }),
              dependencies: [
                {
                  ...(isExternal
                    ? {
                        type: "external" as const,
                        packageName: source.split("/")[0] || source,
                        importPath: source,
                      }
                    : {
                        type: "internal" as const,
                        filePath: resolvedSource,
                      }),
                  dependsOn: [originalName],
                },
              ],
              uri: generateDeclarationUri({
                filename,
                name: exportedName,
                projectRoot,
              }),
            });
          }
        }
      } else if (
        "declaration" in exportNamedDecl &&
        exportNamedDecl.declaration
      ) {
        const extractedList = await extractFromModuleItem({
          item: exportNamedDecl.declaration as ModuleItem,
          sourceLines,
          isExported: true,
          filename,
          projectRoot,
          importedIdentifiers,
          pathAliases,
          processor: processModuleBody,
          namespacePrefix,
        });
        for (const extracted of extractedList) {
          const raw = extractRawCode(
            (exportNamedDecl.declaration as ModuleItem).span,
            sourceLines,
          );
          extracted.dependencies = findDependencies({
            code: raw,
            importedIdentifiers,
          });
          declarations.push(extracted);
        }
      }
    }

    if (item.type === "ExportAllDeclaration") {
      const exportAllDecl = item as ExportAllDeclaration;
      const source = exportAllDecl.source.value;
      const isExternal = isExternalPackage({
        importPath: source,
        pathAliases,
      });
      const resolvedSource = isExternal
        ? source
        : await resolveInternalPathAsync({
            importPath: source,
            currentFilePath: filename,
            pathAliases,
            projectRoot,
          });

      declarations.push({
        name: "*",
        type: "const",
        isExported: true,
        isReExport: true,
        reExportSource: resolvedSource,
        position: spanToPosition({
          span: exportAllDecl.span,
          sourceLines,
        }),
        dependencies: [
          {
            ...(isExternal
              ? {
                  type: "external" as const,
                  packageName: source.split("/")[0] || source,
                  importPath: source,
                }
              : {
                  type: "internal" as const,
                  filePath: resolvedSource,
                }),
            dependsOn: ["*"],
          },
        ],
        uri: generateDeclarationUri({
          filename,
          name: "re-export-all",
          projectRoot,
        }),
      });
    }

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
        const name = decl.identifier?.value || "default";

        const baseDeclaration: DeclarationData = {
          name,
          type:
            decl.type === "FunctionExpression"
              ? ("function" as const)
              : ("class" as const),
          isExported: true,
          isDefault: true,
          position,
          dependencies: findDependencies({
            code: raw,
            importedIdentifiers,
          }),
          uri: generateDeclarationUri({
            filename,
            name,
            projectRoot,
          }),
        };

        if (decl.type === "FunctionExpression") {
          const funcInfo = extractFunctionInfo(decl);
          Object.assign(baseDeclaration, funcInfo);
        } else if (decl.type === "ClassExpression") {
          const classInfo = extractClassInfo(decl);
          Object.assign(baseDeclaration, classInfo);
        }

        declarations.push(baseDeclaration);
      }
    }

    if (!isExportRelated(item)) {
      const extractedList = await extractFromModuleItem({
        item,
        sourceLines,
        isExported: false,
        filename,
        projectRoot,
        importedIdentifiers,
        pathAliases,
        processor: processModuleBody,
        namespacePrefix,
      });
      for (const extracted of extractedList) {
        const raw = extractRawCode(item.span, sourceLines);
        extracted.dependencies = findDependencies({
          code: raw,
          importedIdentifiers,
        });
        declarations.push(extracted);
      }
    }
  }
}
