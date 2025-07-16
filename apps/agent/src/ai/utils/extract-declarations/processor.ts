import type {
  ConstructorMemberMetadata,
  DeclarationCodeMetadata,
  EnumMemberMetadata,
  GetterMemberMetadata,
  MethodMemberMetadata,
  PropertyMemberMetadata,
  SetterMemberMetadata,
} from "@weldr/shared/types/declarations";
import * as ts from "typescript";
import {
  extractExpressionType,
  extractParameterInfo,
  extractRawCode,
  extractType,
  extractTypeAnnotation,
  extractTypeParameters,
  getNodePosition,
  inferReturnTypeFromFunctionBody,
  inferTypeFromExpression,
} from "./ast-utils";
import { findDependencies } from "./dependencies";
import {
  generateDeclarationUri,
  isExternalPackage,
  resolveInternalPathAsync,
} from "./path-utils";

export async function processSourceFile({
  sourceFile,
  sourceCode,
  sourceLines,
  filename,
  pathAliases,
  declarations,
  importedIdentifiers,
}: {
  sourceFile: ts.SourceFile;
  sourceCode: string;
  sourceLines: string[];
  filename: string;
  pathAliases?: Record<string, string>;
  declarations: DeclarationCodeMetadata[];
  importedIdentifiers: Map<string, { source: string; isExternal: boolean }>;
}): Promise<void> {
  // Process all top-level statements
  for (const statement of sourceFile.statements) {
    await processStatement({
      statement,
      sourceFile,
      sourceCode,
      sourceLines,
      filename,
      pathAliases,
      declarations,
      importedIdentifiers,
      isExported: false,
    });
  }
}

async function processStatement({
  statement,
  sourceFile,
  sourceCode,
  sourceLines,
  filename,
  pathAliases,
  declarations,
  importedIdentifiers,
  isExported,
}: {
  statement: ts.Statement;
  sourceFile: ts.SourceFile;
  sourceCode: string;
  sourceLines: string[];
  filename: string;
  pathAliases?: Record<string, string>;
  declarations: DeclarationCodeMetadata[];
  importedIdentifiers: Map<string, { source: string; isExternal: boolean }>;
  isExported: boolean;
}): Promise<void> {
  // Handle import declarations
  if (ts.isImportDeclaration(statement)) {
    await processImportDeclaration(
      statement,
      importedIdentifiers,
      filename,
      pathAliases,
    );
    return;
  }

  // Individual type checks will handle export detection
  const actuallyExported = isExported;

  // Handle different types of declarations
  if (ts.isFunctionDeclaration(statement)) {
    const funcDecl = await processFunctionDeclaration(
      statement,
      sourceFile,
      sourceCode,
      sourceLines,
      filename,
      actuallyExported,
      importedIdentifiers,
    );
    if (funcDecl) declarations.push(funcDecl);
  } else if (ts.isClassDeclaration(statement)) {
    const classDecl = await processClassDeclaration(
      statement,
      sourceFile,
      sourceCode,
      sourceLines,
      filename,
      actuallyExported,
      importedIdentifiers,
      declarations,
    );
    if (classDecl) declarations.push(classDecl);
  } else if (ts.isInterfaceDeclaration(statement)) {
    const interfaceDecl = await processInterfaceDeclaration(
      statement,
      sourceFile,
      sourceCode,
      sourceLines,
      filename,
      actuallyExported,
    );
    if (interfaceDecl) declarations.push(interfaceDecl);
  } else if (ts.isTypeAliasDeclaration(statement)) {
    const typeDecl = await processTypeAliasDeclaration(
      statement,
      sourceFile,
      sourceCode,
      sourceLines,
      filename,
      actuallyExported,
    );
    if (typeDecl) declarations.push(typeDecl);
  } else if (ts.isEnumDeclaration(statement)) {
    const enumDecl = await processEnumDeclaration(
      statement,
      sourceFile,
      sourceCode,
      sourceLines,
      filename,
      actuallyExported,
    );
    if (enumDecl) declarations.push(enumDecl);
  } else if (ts.isModuleDeclaration(statement)) {
    const moduleDecl = await processModuleDeclaration(
      statement,
      sourceFile,
      sourceCode,
      sourceLines,
      filename,
      actuallyExported,
      pathAliases,
      declarations,
      importedIdentifiers,
    );
    if (moduleDecl) declarations.push(moduleDecl);
  } else if (ts.isVariableStatement(statement)) {
    const varDecls = await processVariableStatement(
      statement,
      sourceFile,
      sourceCode,
      sourceLines,
      filename,
      actuallyExported,
      importedIdentifiers,
    );
    declarations.push(...varDecls);
  } else if (ts.isExportDeclaration(statement)) {
    // Handle re-exports
    await processExportDeclaration(
      statement,
      sourceFile,
      sourceCode,
      sourceLines,
      filename,
      pathAliases,
      declarations,
      importedIdentifiers,
    );
  } else if (ts.isExportAssignment(statement)) {
    // Handle export default
    await processExportAssignment(
      statement,
      sourceFile,
      sourceCode,
      sourceLines,
      filename,
      declarations,
      importedIdentifiers,
    );
  }
}

async function processImportDeclaration(
  importDecl: ts.ImportDeclaration,
  importedIdentifiers: Map<string, { source: string; isExternal: boolean }>,
  filename: string,
  pathAliases?: Record<string, string>,
): Promise<void> {
  const moduleSpecifier = importDecl.moduleSpecifier;
  if (!ts.isStringLiteral(moduleSpecifier)) return;

  const source = moduleSpecifier.text;
  const isExternal = isExternalPackage({ importPath: source, pathAliases });
  const resolvedSource = isExternal
    ? source
    : await resolveInternalPathAsync({
        importPath: source,
        currentFilePath: filename,
        pathAliases,
      });

  if (importDecl.importClause) {
    // Default import
    if (importDecl.importClause.name) {
      importedIdentifiers.set(importDecl.importClause.name.text, {
        source: resolvedSource,
        isExternal,
      });
    }

    // Named imports
    if (importDecl.importClause.namedBindings) {
      if (ts.isNamedImports(importDecl.importClause.namedBindings)) {
        for (const element of importDecl.importClause.namedBindings.elements) {
          importedIdentifiers.set(element.name.text, {
            source: resolvedSource,
            isExternal,
          });
        }
      } else if (ts.isNamespaceImport(importDecl.importClause.namedBindings)) {
        importedIdentifiers.set(
          importDecl.importClause.namedBindings.name.text,
          {
            source: resolvedSource,
            isExternal,
          },
        );
      }
    }
  }
}

async function processFunctionDeclaration(
  funcDecl: ts.FunctionDeclaration,
  sourceFile: ts.SourceFile,
  sourceCode: string,
  sourceLines: string[],
  filename: string,
  isExported: boolean,
  importedIdentifiers: Map<string, { source: string; isExternal: boolean }>,
): Promise<DeclarationCodeMetadata | null> {
  if (!funcDecl.name) return null;

  const name = funcDecl.name.text;
  const position = getNodePosition(funcDecl, sourceFile, sourceLines);

  const typeParameters = funcDecl.typeParameters
    ? extractTypeParameters(funcDecl.typeParameters)
    : undefined;

  const parameters = funcDecl.parameters.map((param) =>
    extractParameterInfo(param),
  );

  const returnType = funcDecl.type
    ? extractTypeAnnotation(funcDecl.type)
    : inferReturnTypeFromFunctionBody(funcDecl, parameters);

  const typeParams = typeParameters ? `<${typeParameters.join(", ")}>` : "";
  const params = parameters
    .map(
      (p) =>
        `${p.isRest ? "..." : ""}${p.name}${p.isOptional ? "?" : ""}: ${p.type}`,
    )
    .join(", ");
  const returnTypeStr = returnType;
  const asyncPrefix = funcDecl.modifiers?.some(
    (m) => m.kind === ts.SyntaxKind.AsyncKeyword,
  )
    ? "async "
    : "";
  const generatorSuffix = funcDecl.asteriskToken ? "*" : "";
  const typeSignature = `${asyncPrefix}function${generatorSuffix}${typeParams}(${params}): ${returnTypeStr}`;

  const raw = extractRawCode(funcDecl, sourceCode);
  const dependencies = findDependencies({ code: raw, importedIdentifiers });

  return {
    name,
    type: "function",
    isExported,
    position,
    dependencies,
    uri: generateDeclarationUri({ filename, name }),
    typeParameters,
    typeSignature,
    isAsync:
      funcDecl.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword) ||
      false,
    isGenerator: !!funcDecl.asteriskToken,
    parameters,
    returnType,
  };
}

async function processClassDeclaration(
  classDecl: ts.ClassDeclaration,
  sourceFile: ts.SourceFile,
  sourceCode: string,
  sourceLines: string[],
  filename: string,
  isExported: boolean,
  importedIdentifiers: Map<string, { source: string; isExternal: boolean }>,
  declarations: DeclarationCodeMetadata[],
): Promise<DeclarationCodeMetadata | null> {
  if (!classDecl.name) return null;

  const name = classDecl.name.text;
  const position = getNodePosition(classDecl, sourceFile, sourceLines);

  const typeParameters = classDecl.typeParameters
    ? extractTypeParameters(classDecl.typeParameters)
    : undefined;

  const extendsClause = classDecl.heritageClauses?.find(
    (clause) => clause.token === ts.SyntaxKind.ExtendsKeyword,
  )?.types[0]?.expression;
  const extendsType = extendsClause
    ? extractExpressionType(extendsClause)
    : undefined;

  const implementsClause = classDecl.heritageClauses
    ?.find((clause) => clause.token === ts.SyntaxKind.ImplementsKeyword)
    ?.types.map((type) => extractExpressionType(type.expression));

  const typeParams = typeParameters ? `<${typeParameters.join(", ")}>` : "";
  const extendsStr = extendsType ? ` extends ${extendsType}` : "";
  const implementsStr = implementsClause?.length
    ? ` implements ${implementsClause.join(", ")}`
    : "";
  const typeSignature = `class${typeParams}${extendsStr}${implementsStr}`;

  const raw = extractRawCode(classDecl, sourceCode);
  const dependencies = findDependencies({ code: raw, importedIdentifiers });

  // Process class members
  let constructorInfo: ConstructorMemberMetadata | undefined;

  const methods: MethodMemberMetadata[] = [];
  const properties: PropertyMemberMetadata[] = [];

  const getters: GetterMemberMetadata[] = [];
  const setters: SetterMemberMetadata[] = [];

  // Helper function to check modifiers
  const hasModifier = (
    member: ts.ClassElement,
    kind: ts.SyntaxKind,
  ): boolean => {
    return (
      // biome-ignore lint/suspicious/noExplicitAny: TypeScript ClassElement doesn't have modifiers property but implementations do
      (member as any).modifiers?.some((m: ts.Modifier) => m.kind === kind) ??
      false
    );
  };

  for (const member of classDecl.members) {
    const isStatic = hasModifier(member, ts.SyntaxKind.StaticKeyword);
    const isPrivate = hasModifier(member, ts.SyntaxKind.PrivateKeyword);
    const isProtected = hasModifier(member, ts.SyntaxKind.ProtectedKeyword);

    if (ts.isConstructorDeclaration(member)) {
      const parameters = member.parameters.map((param) =>
        extractParameterInfo(param),
      );
      const constructorPosition = getNodePosition(
        member,
        sourceFile,
        sourceLines,
      );

      const constructorRaw = extractRawCode(member, sourceCode);
      const constructorDependencies = findDependencies({
        code: constructorRaw,
        importedIdentifiers,
      });

      constructorInfo = {
        name: "constructor",
        type: "constructor",
        uri: generateDeclarationUri({ filename, name: `${name}.constructor` }),
        position: constructorPosition,
        dependencies: constructorDependencies,
        isStatic: false, // constructors are never static
        isPrivate,
        isProtected,
        parameters,
        typeSignature: `constructor(${parameters.map((p) => `${p.isRest ? "..." : ""}${p.name}${p.isOptional ? "?" : ""}: ${p.type}`).join(", ")})`,
      };
    } else if (ts.isMethodDeclaration(member) && member.name) {
      const memberName = ts.isIdentifier(member.name)
        ? member.name.text
        : member.name.getText();
      const memberPosition = getNodePosition(member, sourceFile, sourceLines);

      const parameters = member.parameters.map((param) =>
        extractParameterInfo(param),
      );

      const returnType = member.type
        ? extractTypeAnnotation(member.type)
        : inferReturnTypeFromFunctionBody(member, parameters);

      const isAsync = hasModifier(member, ts.SyntaxKind.AsyncKeyword);
      const isGenerator = !!member.asteriskToken;

      const memberRaw = extractRawCode(member, sourceCode);
      const memberDependencies = findDependencies({
        code: memberRaw,
        importedIdentifiers,
      });

      methods.push({
        name: memberName,
        type: "method",
        uri: generateDeclarationUri({
          filename,
          name: `${name}.${memberName}`,
        }),
        position: memberPosition,
        dependencies: memberDependencies,
        isStatic,
        isPrivate,
        isProtected,
        isAsync,
        isGenerator,
        parameters,
        returnType,
        typeSignature: `${isAsync ? "async " : ""}${isGenerator ? "*" : ""}${memberName}(${parameters.map((p) => `${p.isRest ? "..." : ""}${p.name}${p.isOptional ? "?" : ""}: ${p.type}`).join(", ")}): ${returnType}`,
      });
    } else if (ts.isPropertyDeclaration(member) && member.name) {
      const memberName = ts.isIdentifier(member.name)
        ? member.name.text
        : member.name.getText();
      const memberPosition = getNodePosition(member, sourceFile, sourceLines);
      const propType = member.type
        ? extractTypeAnnotation(member.type)
        : member.initializer
          ? inferTypeFromExpression(member.initializer)
          : "any";

      const isReadonly = hasModifier(member, ts.SyntaxKind.ReadonlyKeyword);
      const isOptional = !!member.questionToken;
      const initializer = member.initializer?.getText();

      const memberRaw = extractRawCode(member, sourceCode);
      const memberDependencies = findDependencies({
        code: memberRaw,
        importedIdentifiers,
      });

      properties.push({
        name: memberName,
        type: "property",
        uri: generateDeclarationUri({
          filename,
          name: `${name}.${memberName}`,
        }),
        position: memberPosition,
        dependencies: memberDependencies,
        isStatic,
        isPrivate,
        isProtected,
        valueType: propType,
        isReadonly,
        isOptional,
        initializer,
        typeSignature: `${isReadonly ? "readonly " : ""}${memberName}${isOptional ? "?" : ""}: ${propType}${initializer ? ` = ${initializer}` : ""}`,
      });
    } else if (ts.isGetAccessorDeclaration(member) && member.name) {
      const memberName = ts.isIdentifier(member.name)
        ? member.name.text
        : member.name.getText();
      const memberPosition = getNodePosition(member, sourceFile, sourceLines);
      const returnType = member.type
        ? extractTypeAnnotation(member.type)
        : "any";

      const memberRaw = extractRawCode(member, sourceCode);
      const memberDependencies = findDependencies({
        code: memberRaw,
        importedIdentifiers,
      });

      getters.push({
        name: memberName,
        type: "getter",
        uri: generateDeclarationUri({
          filename,
          name: `${name}.${memberName}`,
        }),
        position: memberPosition,
        dependencies: memberDependencies,
        isStatic,
        isPrivate,
        isProtected,
        returnType,
        typeSignature: `get ${memberName}(): ${returnType}`,
      });
    } else if (ts.isSetAccessorDeclaration(member) && member.name) {
      const memberName = ts.isIdentifier(member.name)
        ? member.name.text
        : member.name.getText();
      const memberPosition = getNodePosition(member, sourceFile, sourceLines);
      const parameter = member.parameters[0];
      const parameterInfo = parameter
        ? extractParameterInfo(parameter)
        : {
            name: "value",
            type: "any",
            isOptional: false,
            isRest: false,
          };

      const memberRaw = extractRawCode(member, sourceCode);
      const memberDependencies = findDependencies({
        code: memberRaw,
        importedIdentifiers,
      });

      setters.push({
        name: memberName,
        type: "setter",
        uri: generateDeclarationUri({
          filename,
          name: `${name}.${memberName}`,
        }),
        position: memberPosition,
        dependencies: memberDependencies,
        isStatic,
        isPrivate,
        isProtected,
        parameter: {
          name: parameterInfo.name,
          type: parameterInfo.type,
        },
        typeSignature: `set ${memberName}(${parameterInfo.name}: ${parameterInfo.type})`,
      });
    }
  }

  // Add public class members as individual declarations
  if (constructorInfo && !constructorInfo.isPrivate) {
    declarations.push(constructorInfo);
  }

  for (const method of methods) {
    if (!method.isPrivate) {
      declarations.push(method);
    }
  }

  for (const property of properties) {
    if (!property.isPrivate) {
      declarations.push(property);
    }
  }

  for (const getter of getters) {
    if (!getter.isPrivate) {
      declarations.push(getter);
    }
  }

  for (const setter of setters) {
    if (!setter.isPrivate) {
      declarations.push(setter);
    }
  }

  return {
    name,
    type: "class",
    isExported,
    position,
    dependencies,
    uri: generateDeclarationUri({ filename, name }),
    typeParameters,
    typeSignature,
    extends: extendsType,
    implements: implementsClause,
    constructor: constructorInfo,
    methods: methods.length > 0 ? methods : undefined,
    properties: properties.length > 0 ? properties : undefined,
    getters: getters.length > 0 ? getters : undefined,
    setters: setters.length > 0 ? setters : undefined,
  };
}

async function processInterfaceDeclaration(
  interfaceDecl: ts.InterfaceDeclaration,
  sourceFile: ts.SourceFile,
  sourceCode: string,
  sourceLines: string[],
  filename: string,
  isExported: boolean,
): Promise<DeclarationCodeMetadata | null> {
  const name = interfaceDecl.name.text;
  const position = getNodePosition(interfaceDecl, sourceFile, sourceLines);

  const typeParameters = interfaceDecl.typeParameters
    ? extractTypeParameters(interfaceDecl.typeParameters)
    : undefined;

  const extendsClause = interfaceDecl.heritageClauses
    ?.find((clause) => clause.token === ts.SyntaxKind.ExtendsKeyword)
    ?.types.map((type) => extractExpressionType(type.expression));

  const typeParams = typeParameters ? `<${typeParameters.join(", ")}>` : "";
  const extendsStr = extendsClause?.length
    ? ` extends ${extendsClause.join(", ")}`
    : "";
  const typeSignature = `interface${typeParams}${extendsStr}`;

  return {
    name,
    type: "interface",
    isExported,
    position,
    dependencies: [], // Interfaces don't have runtime dependencies in the same way
    uri: generateDeclarationUri({ filename, name }),
    typeParameters,
    typeSignature,
    extends: extendsClause,
  };
}

async function processTypeAliasDeclaration(
  typeAliasDecl: ts.TypeAliasDeclaration,
  sourceFile: ts.SourceFile,
  sourceCode: string,
  sourceLines: string[],
  filename: string,
  isExported: boolean,
): Promise<DeclarationCodeMetadata | null> {
  const name = typeAliasDecl.name.text;
  const position = getNodePosition(typeAliasDecl, sourceFile, sourceLines);

  const typeParameters = typeAliasDecl.typeParameters
    ? extractTypeParameters(typeAliasDecl.typeParameters)
    : undefined;

  const aliasedType = extractType(typeAliasDecl.type);
  const typeParams = typeParameters ? `<${typeParameters.join(", ")}>` : "";
  const typeSignature = `type${typeParams} = ${aliasedType}`;

  return {
    name,
    type: "type",
    isExported,
    position,
    dependencies: [],
    uri: generateDeclarationUri({ filename, name }),
    typeParameters,
    typeSignature,
  };
}

async function processEnumDeclaration(
  enumDecl: ts.EnumDeclaration,
  sourceFile: ts.SourceFile,
  sourceCode: string,
  sourceLines: string[],
  filename: string,
  isExported: boolean,
): Promise<DeclarationCodeMetadata | null> {
  const name = enumDecl.name.text;
  const position = getNodePosition(enumDecl, sourceFile, sourceLines);

  const enumMembers = enumDecl.members.map((member) => {
    const memberName = ts.isIdentifier(member.name)
      ? member.name.text
      : member.name.getText();

    const enumMember: EnumMemberMetadata = { name: memberName };

    if (member.initializer) {
      enumMember.initializer = member.initializer.getText();
    }

    return enumMember;
  });

  return {
    name,
    type: "enum",
    isExported,
    position,
    dependencies: [],
    uri: generateDeclarationUri({ filename, name }),
    typeSignature: `enum ${name}`,
    enumMembers,
  };
}

async function processVariableStatement(
  varStatement: ts.VariableStatement,
  sourceFile: ts.SourceFile,
  sourceCode: string,
  sourceLines: string[],
  filename: string,
  isExported: boolean,
  importedIdentifiers: Map<string, { source: string; isExternal: boolean }>,
): Promise<DeclarationCodeMetadata[]> {
  const declarations: DeclarationCodeMetadata[] = [];

  for (const declaration of varStatement.declarationList.declarations) {
    if (ts.isIdentifier(declaration.name)) {
      const name = declaration.name.text;
      const position = getNodePosition(varStatement, sourceFile, sourceLines);

      let typeSignature: string;
      const varKind =
        varStatement.declarationList.flags & ts.NodeFlags.Const
          ? "const"
          : varStatement.declarationList.flags & ts.NodeFlags.Let
            ? "let"
            : "var";

      if (declaration.type) {
        const typeAnnotation = extractTypeAnnotation(declaration.type);
        typeSignature = `${varKind} ${name}: ${typeAnnotation}`;
      } else if (declaration.initializer) {
        const inferredType = inferTypeFromExpression(declaration.initializer);
        typeSignature = `${varKind} ${name}: ${inferredType}`;
      } else {
        typeSignature = `${varKind} ${name}`;
      }

      const raw = extractRawCode(varStatement, sourceCode);
      const dependencies = findDependencies({ code: raw, importedIdentifiers });

      declarations.push({
        name,
        type: varKind as "const" | "let" | "var",
        isExported,
        position,
        dependencies,
        uri: generateDeclarationUri({ filename, name }),
        typeSignature,
      });
    }
  }

  return declarations;
}

async function processModuleDeclaration(
  moduleDecl: ts.ModuleDeclaration,
  sourceFile: ts.SourceFile,
  sourceCode: string,
  sourceLines: string[],
  filename: string,
  isExported: boolean,
  pathAliases?: Record<string, string>,
  declarations?: DeclarationCodeMetadata[],
  importedIdentifiers?: Map<string, { source: string; isExternal: boolean }>,
): Promise<DeclarationCodeMetadata | null> {
  if (!moduleDecl.name || !ts.isIdentifier(moduleDecl.name)) return null;

  const name = moduleDecl.name.text;
  const position = getNodePosition(moduleDecl, sourceFile, sourceLines);

  // Process nested declarations within the namespace
  if (moduleDecl.body && ts.isModuleBlock(moduleDecl.body)) {
    const nestedDeclarations: DeclarationCodeMetadata[] = [];
    const nestedImportedIdentifiers = new Map(importedIdentifiers || []);

    for (const statement of moduleDecl.body.statements) {
      await processStatement({
        statement,
        sourceFile,
        sourceCode,
        sourceLines,
        filename,
        pathAliases,
        declarations: nestedDeclarations,
        importedIdentifiers: nestedImportedIdentifiers,
        isExported: true, // Everything in a namespace is considered exported within that namespace
      });
    }

    // Add nested declarations to the main declarations array with namespace prefix
    if (declarations) {
      for (const nested of nestedDeclarations) {
        nested.name = `${name}.${nested.name}`;
        nested.uri = `${filename}#${nested.name}`;
        declarations.push(nested);
      }
    }
  }

  return {
    name,
    type: "namespace",
    isExported,
    position,
    dependencies: [],
    uri: generateDeclarationUri({ filename, name }),
    typeSignature: `namespace ${name}`,
  };
}

async function processExportDeclaration(
  exportDecl: ts.ExportDeclaration,
  sourceFile: ts.SourceFile,
  sourceCode: string,
  sourceLines: string[],
  filename: string,
  pathAliases: Record<string, string> | undefined,
  declarations: DeclarationCodeMetadata[],
  importedIdentifiers: Map<string, { source: string; isExternal: boolean }>,
): Promise<void> {
  // Handle re-exports - simplified for now
  if (
    exportDecl.moduleSpecifier &&
    ts.isStringLiteral(exportDecl.moduleSpecifier)
  ) {
    const source = exportDecl.moduleSpecifier.text;
    const position = getNodePosition(exportDecl, sourceFile, sourceLines);

    declarations.push({
      name: "*",
      type: "const",
      isExported: true,
      isReExport: true,
      reExportSource: source,
      position,
      dependencies: [],
      uri: generateDeclarationUri({ filename, name: "re-export" }),
    });
  }
}

async function processExportAssignment(
  exportAssignment: ts.ExportAssignment,
  sourceFile: ts.SourceFile,
  sourceCode: string,
  sourceLines: string[],
  filename: string,
  declarations: DeclarationCodeMetadata[],
  importedIdentifiers: Map<string, { source: string; isExternal: boolean }>,
): Promise<void> {
  // Handle export default - simplified for now
  const position = getNodePosition(exportAssignment, sourceFile, sourceLines);
  const raw = extractRawCode(exportAssignment, sourceCode);
  const dependencies = findDependencies({ code: raw, importedIdentifiers });

  declarations.push({
    name: "default",
    type: "const",
    isExported: true,
    isDefault: true,
    position,
    dependencies,
    uri: generateDeclarationUri({ filename, name: "default" }),
    typeSignature: "export default",
  });
}
