import type {
  ArrowFunctionExpression,
  BindingIdentifier,
  ClassDeclaration,
  ClassExpression,
  ClassMember,
  Expression,
  FunctionDeclaration,
  FunctionExpression,
  ModuleItem,
  Param,
  Pattern,
  Span,
  TsEnumDeclaration,
  TsEnumMember,
  TsExpressionWithTypeArguments,
  TsInterfaceDeclaration,
  TsModuleDeclaration,
  TsType,
  TsTypeAliasDeclaration,
  TsTypeParameter,
  VariableDeclarator,
} from "@swc/types";
import type {
  ClassMemberInfo,
  DeclarationData,
  DeclarationPosition,
  EnumMemberInfo,
  MethodSignature,
} from "@weldr/shared/types/declarations";

// Extract function information including async, generator, parameters, return type
export function extractFunctionInfo(
  func: FunctionDeclaration | FunctionExpression | ArrowFunctionExpression,
): Partial<DeclarationData> {
  const info: Partial<DeclarationData> = {
    isAsync: func.async || false,
    isGenerator: func.generator || false,
  };

  // Extract type parameters
  if (func.typeParameters) {
    info.typeParameters = extractTypeParameters(func.typeParameters);
  }

  // Extract parameters
  if (func.params) {
    info.parameters = func.params.map((param: Param | Pattern) =>
      extractParameterInfo(param),
    );
  }

  // Extract return type
  if (func.returnType) {
    info.returnType = extractTypeAnnotation(func.returnType);
  }

  // Build full type signature
  const typeParams = info.typeParameters
    ? `<${info.typeParameters.join(", ")}>`
    : "";
  const params = info.parameters
    ? info.parameters
        .map(
          (p) =>
            `${p.isRest ? "..." : ""}${p.name}${p.isOptional ? "?" : ""}: ${p.type}`,
        )
        .join(", ")
    : "";
  const returnType = info.returnType || "void";
  const asyncPrefix = info.isAsync ? "async " : "";
  const generatorSuffix = info.isGenerator ? "*" : "";

  info.typeSignature = `${asyncPrefix}function${generatorSuffix}${typeParams}(${params}): ${returnType}`;

  return info;
}

// Extract class information including extends, implements, and members
export function extractClassInfo(
  cls: ClassDeclaration | ClassExpression,
): Partial<DeclarationData> {
  const info: Partial<DeclarationData> = {};

  // Extract type parameters
  if (cls.typeParams) {
    info.typeParameters = extractTypeParameters(cls.typeParams);
  }

  // Extract extends clause
  if (cls.superClass) {
    info.extends = extractExpressionType(cls.superClass);
  }

  // Extract implements clause
  if (cls.implements && cls.implements.length > 0) {
    info.implements = cls.implements.map(
      (impl: TsExpressionWithTypeArguments) =>
        extractExpressionType(impl.expression),
    );
  }

  // Extract class members
  if (cls.body && cls.body.length > 0) {
    info.members = extractClassMembers(cls.body);
  }

  // Build type signature
  const typeParams = info.typeParameters
    ? `<${info.typeParameters.join(", ")}>`
    : "";
  const extendsClause = info.extends ? ` extends ${info.extends}` : "";
  const implementsClause =
    info.implements && info.implements.length > 0
      ? ` implements ${info.implements.join(", ")}`
      : "";

  info.typeSignature = `class${typeParams}${extendsClause}${implementsClause}`;

  return info;
}

// Extract class members (properties, methods, constructor)
function extractClassMembers(members: ClassMember[]): ClassMemberInfo {
  const memberInfo: ClassMemberInfo = {
    properties: [],
    methods: [],
    constructor: undefined,
  };

  for (const member of members) {
    switch (member.type) {
      case "Constructor":
        memberInfo.constructor = {
          name: "constructor",
          isStatic: false,
          isPrivate: false,
          isProtected: false,
          isAsync: false,
          isGenerator: false,
          parameters: member.params.map((p) => {
            if ("pat" in p) {
              return extractParameterInfo(p.pat);
            }
            // This handles TsParameterProperty
            return extractParameterInfo(p.param);
          }),
          returnType: "void",
        };
        break;

      case "ClassMethod":
        if (member.key.type === "Identifier") {
          const method: MethodSignature = {
            name: member.key.value,
            isStatic: member.isStatic || false,
            isPrivate: member.accessibility === "private",
            isProtected: member.accessibility === "protected",
            isAsync: member.function.async || false,
            isGenerator: member.function.generator || false,
            parameters: member.function.params.map((p: Param) =>
              extractParameterInfo(p),
            ),
            returnType: member.function.returnType
              ? extractTypeAnnotation(member.function.returnType)
              : "void",
          };

          if (member.function.typeParameters) {
            method.typeParameters = extractTypeParameters(
              member.function.typeParameters,
            );
          }

          memberInfo.methods.push(method);
        }
        break;

      case "ClassProperty":
        if (member.key.type === "Identifier") {
          memberInfo.properties.push({
            name: member.key.value,
            type: member.typeAnnotation
              ? extractTypeAnnotation(member.typeAnnotation)
              : "any",
            isStatic: member.isStatic || false,
            isPrivate: member.accessibility === "private",
            isProtected: member.accessibility === "protected",
            isReadonly: member.readonly || false,
            isOptional: member.isOptional || false,
          });
        }
        break;

      case "PrivateMethod":
        if (member.key.type === "PrivateName") {
          const method: MethodSignature = {
            name: `#${member.key.id.value}`,
            isStatic: member.isStatic || false,
            isPrivate: true,
            isProtected: false,
            isAsync: member.function.async || false,
            isGenerator: member.function.generator || false,
            parameters: member.function.params.map((p: Param) =>
              extractParameterInfo(p),
            ),
            returnType: member.function.returnType
              ? extractTypeAnnotation(member.function.returnType)
              : "void",
          };
          memberInfo.methods.push(method);
        }
        break;

      case "PrivateProperty":
        if (member.key.type === "PrivateName") {
          memberInfo.properties.push({
            name: `#${member.key.id.value}`,
            type: member.typeAnnotation
              ? extractTypeAnnotation(member.typeAnnotation)
              : "any",
            isStatic: member.isStatic || false,
            isPrivate: true,
            isProtected: false,
            isReadonly: member.readonly || false,
            isOptional: member.isOptional || false,
          });
        }
        break;
    }
  }

  return memberInfo;
}

// Extract parameter information
function extractParameterInfo(param: Pattern | Param): {
  name: string;
  type: string;
  isOptional: boolean;
  isRest: boolean;
} {
  // Handle Param type
  if ("pat" in param) {
    const p = param as Param;
    return extractParameterInfo(p.pat);
  }

  // Handle Pattern types
  switch (param.type) {
    case "Identifier": {
      const id = param as BindingIdentifier;
      return {
        name: id.value,
        type: id.typeAnnotation
          ? extractTypeAnnotation(id.typeAnnotation)
          : "any",
        isOptional: id.optional || false,
        isRest: false,
      };
    }

    case "RestElement": {
      const restParam = extractParameterInfo(param.argument);
      return {
        ...restParam,
        isRest: true,
      };
    }
    case "AssignmentPattern": {
      return extractParameterInfo(param.left);
    }
    case "ArrayPattern": {
      return {
        name: "_destructured_array",
        type: "any[]",
        isOptional: false,
        isRest: false,
      };
    }
    case "ObjectPattern": {
      return {
        name: "_destructured_object",
        type: "object",
        isOptional: false,
        isRest: false,
      };
    }
    default: {
      return {
        name: "_unknown",
        type: "any",
        isOptional: false,
        isRest: false,
      };
    }
  }
}

// Extract type parameters (generics)
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
function extractTypeParameters(typeParams: any): string[] {
  if (!typeParams || !typeParams.params) return [];

  return typeParams.params.map((param: TsTypeParameter) => {
    let str = param.name.value;
    if (param.constraint) {
      str += ` extends ${extractType(param.constraint)}`;
    }
    if (param.default) {
      str += ` = ${extractType(param.default)}`;
    }
    return str;
  });
}

// Extract type annotation
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
function extractTypeAnnotation(typeAnnotation: any): string {
  if (!typeAnnotation) return "any";
  if ("typeAnnotation" in typeAnnotation && typeAnnotation.typeAnnotation) {
    return extractType(typeAnnotation.typeAnnotation);
  }
  return extractType(typeAnnotation as TsType);
}

// Extract expression type (for extends/implements)
function extractExpressionType(expr: Expression): string {
  switch (expr.type) {
    case "Identifier":
      return expr.value;
    case "MemberExpression":
      if (
        expr.object.type === "Identifier" &&
        expr.property.type === "Identifier"
      ) {
        return `${expr.object.value}.${expr.property.value}`;
      }
      return "unknown";
    default:
      return "unknown";
  }
}

// Comprehensive type extraction
function extractType(type: TsType): string {
  switch (type.type) {
    case "TsKeywordType":
      return type.kind;

    case "TsTypeReference": {
      let base =
        type.typeName.type === "Identifier"
          ? type.typeName.value
          : extractQualifiedName(type.typeName);

      if (type.typeParams) {
        const params = type.typeParams.params
          .map((p) => extractType(p))
          .join(", ");
        base += `<${params}>`;
      }
      return base;
    }
    case "TsArrayType": {
      return `${extractType(type.elemType)}[]`;
    }
    case "TsTupleType": {
      const elements = type.elemTypes.map((e) => extractType(e.ty)).join(", ");
      return `[${elements}]`;
    }
    case "TsUnionType": {
      return type.types.map((t) => extractType(t)).join(" | ");
    }
    case "TsIntersectionType": {
      return type.types.map((t) => extractType(t)).join(" & ");
    }
    case "TsThisType":
      return "this";

    case "TsConstructorType": {
      const funcParams = type.params
        .map((p) => extractParameterInfo(p))
        .map((p) => `${p.name}: ${p.type}`)
        .join(", ");
      const funcReturn = type.typeAnnotation
        ? extractTypeAnnotation(type.typeAnnotation)
        : "void";
      const abstract = type.isAbstract ? "abstract " : "";
      return `${abstract}new (${funcParams}) => ${funcReturn}`;
    }

    case "TsInferType":
      return `infer ${type.typeParam.name.value}`;

    case "TsParenthesizedType":
      return `(${extractType(type.typeAnnotation)})`;

    case "TsTypeOperator": {
      const op = type.op;
      const operand = extractType(type.typeAnnotation);
      return `${op} ${operand}`;
    }

    case "TsTypePredicate": {
      const asserts = type.asserts ? "asserts " : "";
      const identifier =
        type.paramName.type === "Identifier" ? type.paramName.value : "this";
      if (type.typeAnnotation) {
        const predicateType = extractTypeAnnotation(type.typeAnnotation);
        return `${asserts}${identifier} is ${predicateType}`;
      }
      return `${asserts}${identifier}`;
    }

    case "TsFunctionType": {
      const funcParams = type.params
        .map((p) => extractParameterInfo(p))
        .map((p) => `${p.name}: ${p.type}`)
        .join(", ");
      const funcReturn = type.typeAnnotation
        ? extractTypeAnnotation(type.typeAnnotation)
        : "void";
      return `(${funcParams}) => ${funcReturn}`;
    }
    case "TsTypeLiteral": {
      const memberStrs = type.members
        .map((member) => {
          if (
            member.type === "TsPropertySignature" &&
            member.key.type === "Identifier"
          ) {
            const optional = member.optional ? "?" : "";
            const type = member.typeAnnotation
              ? extractTypeAnnotation(member.typeAnnotation)
              : "any";
            return `${member.key.value}${optional}: ${type}`;
          }
          return "";
        })
        .filter(Boolean);
      return `{ ${memberStrs.join("; ")} }`;
    }
    case "TsLiteralType": {
      if (type.literal.type === "StringLiteral") {
        return `"${type.literal.value}"`;
      }
      if (type.literal.type === "NumericLiteral") {
        return type.literal.value.toString();
      }
      if (type.literal.type === "BooleanLiteral") {
        return type.literal.value.toString();
      }
      return "literal";
    }
    case "TsTypeQuery": {
      if (type.exprName.type === "Identifier") {
        return `typeof ${type.exprName.value}`;
      }
      return "typeof unknown";
    }
    case "TsOptionalType": {
      return `${extractType(type.typeAnnotation)}?`;
    }
    case "TsRestType": {
      return `...${extractType(type.typeAnnotation)}`;
    }
    case "TsConditionalType": {
      const check = extractType(type.checkType);
      const ext = extractType(type.extendsType);
      const trueTy = extractType(type.trueType);
      const falseTy = extractType(type.falseType);
      return `${check} extends ${ext} ? ${trueTy} : ${falseTy}`;
    }
    case "TsIndexedAccessType": {
      const obj = extractType(type.objectType);
      const idx = extractType(type.indexType);
      return `${obj}[${idx}]`;
    }
    case "TsMappedType": {
      return "{ [key: string]: any }"; // Simplified
    }
    case "TsImportType": {
      return type.argument.value;
    }
    default:
      return "any";
  }
}

// Extract qualified names (e.g., Namespace.Type)
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
function extractQualifiedName(name: any): string {
  if (name.type === "Identifier") {
    return name.value;
  }

  if (name.type === "TsQualifiedName") {
    return `${extractQualifiedName(name.left)}.${name.right.value}`;
  }
  return "unknown";
}

export function spanToPosition({
  span,
  sourceLines,
}: {
  span: Span;
  sourceLines: string[];
}): DeclarationPosition {
  // Convert byte offsets to line/column positions
  let startLine = 1;
  let startColumn = 1;
  let endLine = 1;
  let endColumn = 1;
  let currentOffset = 0;

  // Find start position
  for (let i = 0; i < sourceLines.length; i++) {
    const line = sourceLines[i];
    if (line === undefined) continue;
    const lineLength = line.length + 1; // +1 for newline
    if (currentOffset + lineLength > span.start) {
      startLine = i + 1;
      startColumn = span.start - currentOffset + 1;
      break;
    }
    currentOffset += lineLength;
  }

  // Find end position
  currentOffset = 0;
  for (let i = 0; i < sourceLines.length; i++) {
    const line = sourceLines[i];
    if (line === undefined) continue;
    const lineLength = line.length + 1; // +1 for newline
    if (currentOffset + lineLength > span.end) {
      endLine = i + 1;
      endColumn = span.end - currentOffset + 1;
      break;
    }
    currentOffset += lineLength;
  }

  return {
    start: { line: startLine, column: startColumn },
    end: { line: endLine, column: endColumn },
  };
}

export function extractRawCode(span: Span, sourceLines: string[]): string {
  const fullSource = sourceLines.join("\n");
  return fullSource.slice(span.start, span.end);
}

export function extractInterfaceInfo(
  interfaceDecl: TsInterfaceDeclaration,
): Partial<DeclarationData> {
  const info: Partial<DeclarationData> = {};

  // Extract type parameters
  if (interfaceDecl.typeParams) {
    info.typeParameters = extractTypeParameters(interfaceDecl.typeParams);
  }

  // Extract extends clause
  if (interfaceDecl.extends && interfaceDecl.extends.length > 0) {
    info.implements = interfaceDecl.extends.map((ext) =>
      extractExpressionType(ext.expression),
    );
  }

  // Build type signature
  const typeParams = info.typeParameters
    ? `<${info.typeParameters.join(", ")}>`
    : "";
  const extendsClause =
    info.implements && info.implements.length > 0
      ? ` extends ${info.implements.join(", ")}`
      : "";

  info.typeSignature = `interface${typeParams}${extendsClause}`;

  return info;
}

export function extractTypeAliasInfo(
  typeAliasDecl: TsTypeAliasDeclaration,
): Partial<DeclarationData> {
  const info: Partial<DeclarationData> = {};

  // Extract type parameters
  if (typeAliasDecl.typeParams) {
    info.typeParameters = extractTypeParameters(typeAliasDecl.typeParams);
  }

  // Extract the type being aliased
  const aliasedType = extractType(typeAliasDecl.typeAnnotation);

  // Build type signature
  const typeParams = info.typeParameters
    ? `<${info.typeParameters.join(", ")}>`
    : "";
  info.typeSignature = `type${typeParams} = ${aliasedType}`;

  return info;
}

export function extractVariableInfo(
  declarator: VariableDeclarator,
  kind: string,
): Partial<DeclarationData> {
  const info: Partial<DeclarationData> = {};

  // Extract type annotation
  if (
    declarator.id.type === "Identifier" &&
    (declarator.id as BindingIdentifier).typeAnnotation
  ) {
    info.typeSignature = `${kind} ${declarator.id.value}: ${extractTypeAnnotation(
      (declarator.id as BindingIdentifier).typeAnnotation,
    )}`;
  } else if (declarator.init) {
    // Try to infer type from initializer
    const inferredType = inferTypeFromExpression(declarator.init);
    if (declarator.id.type === "Identifier") {
      info.typeSignature = `${kind} ${declarator.id.value}: ${inferredType}`;
    }
  } else if (declarator.id.type === "Identifier") {
    info.typeSignature = `${kind} ${declarator.id.value}`;
  }

  // If it's a function expression, extract function info
  if (
    declarator.init &&
    (declarator.init.type === "FunctionExpression" ||
      declarator.init.type === "ArrowFunctionExpression")
  ) {
    const funcInfo = extractFunctionInfo(
      declarator.init as FunctionExpression | ArrowFunctionExpression,
    );
    Object.assign(info, funcInfo);
  }

  return info;
}

export function extractEnumInfo(
  enumDecl: TsEnumDeclaration,
  sourceLines: string[],
): Partial<DeclarationData> {
  const members: EnumMemberInfo[] = enumDecl.members.map(
    (member: TsEnumMember) => {
      const name =
        member.id.type === "Identifier"
          ? member.id.value
          : member.id.value.toString();

      const enumMember: EnumMemberInfo = { name };

      if (member.init) {
        if ("span" in member.init) {
          enumMember.initializer = extractRawCode(
            member.init.span,
            sourceLines,
          );
        } else {
          enumMember.initializer = "[complex initializer]";
        }
      }
      return enumMember;
    },
  );

  return {
    typeSignature: `enum ${enumDecl.id.value}`,
    enumMembers: members,
  };
}

export async function extractNamespaceInfo(
  moduleDecl: TsModuleDeclaration,
  sourceLines: string[],
  filename: string,
  projectRoot: string,
  importedIdentifiers: Map<string, { source: string; isExternal: boolean }>,
  pathAliases: Record<string, string> | undefined,
  processor: (options: {
    body: ModuleItem[];
    sourceLines: string[];
    filename: string;
    projectRoot: string;
    pathAliases?: Record<string, string>;
    declarations: DeclarationData[];
    importedIdentifiers: Map<string, { source: string; isExternal: boolean }>;
    namespacePrefix?: string;
  }) => Promise<void>,
  namespacePrefix: string,
): Promise<Partial<DeclarationData>> {
  const members: DeclarationData[] = [];
  const localNamespaceName =
    moduleDecl.id.type === "Identifier" ? moduleDecl.id.value : "";

  if (moduleDecl.body?.type !== "TsModuleBlock") {
    return { members };
  }

  const newNamespacePrefix = namespacePrefix
    ? `${namespacePrefix}.${localNamespaceName}`
    : localNamespaceName;

  await processor({
    body: moduleDecl.body.body,
    sourceLines,
    filename,
    projectRoot,
    pathAliases,
    declarations: members,
    importedIdentifiers,
    namespacePrefix: newNamespacePrefix,
  });

  return { members };
}

export function inferTypeFromExpression(expr: Expression): string {
  switch (expr.type) {
    case "StringLiteral":
      return "string";
    case "NumericLiteral":
      return "number";
    case "BooleanLiteral":
      return "boolean";
    case "NullLiteral":
      return "null";
    case "ArrayExpression":
      return "any[]";
    case "ObjectExpression":
      return "object";
    case "FunctionExpression":
    case "ArrowFunctionExpression": {
      // Extract function signature
      const func = expr as ArrowFunctionExpression | FunctionExpression;
      const params = func.params.map((p: Param | Pattern) =>
        extractParameterInfo(p),
      );
      const paramStr = params.map((p) => `${p.name}: ${p.type}`).join(", ");
      const returnType = func.returnType
        ? extractTypeAnnotation(func.returnType)
        : "any";
      return `(${paramStr}) => ${returnType}`;
    }
    case "Identifier":
      return "any"; // Can't infer without context
    default:
      return "any";
  }
}
