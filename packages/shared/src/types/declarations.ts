import type { z } from "zod";
import type { declarationSpecsSchema } from "../validators/declarations";
import type { dbModelDeclarationSpecsSchema } from "../validators/declarations/db-model";
import type { endpointDeclarationSpecsSchema } from "../validators/declarations/endpoint";
import type { pageDeclarationSpecsSchema } from "../validators/declarations/page";
import type { declarationSpecsV1Schema } from "../validators/declarations/v1";

export interface DeclarationPosition {
  start: { line: number; column: number };
  end: { line: number; column: number };
}

export interface ExternalDependency {
  type: "external";
  packageName: string;
  importPath: string;
  dependsOn: string[];
  reason?: string;
}

export interface InternalDependency {
  type: "internal";
  filePath: string;
  dependsOn: string[];
  reason?: string;
}

export type Dependency = ExternalDependency | InternalDependency;

// Enhanced method signature interface
export interface MethodSignature {
  name: string;
  isStatic: boolean;
  isPrivate: boolean;
  isProtected: boolean;
  isAsync: boolean;
  isGenerator: boolean;
  typeParameters?: string[];
  parameters: Array<{
    name: string;
    type: string;
    isOptional: boolean;
    isRest: boolean;
  }>;
  returnType: string;
}

// Enhanced interface for class members
export interface ClassMemberInfo {
  properties: Array<{
    name: string;
    type: string;
    isStatic: boolean;
    isPrivate: boolean;
    isProtected: boolean;
    isReadonly: boolean;
    isOptional: boolean;
  }>;
  methods: MethodSignature[];
  constructor?: MethodSignature;
}

export interface EnumMemberInfo {
  name: string;
  initializer?: string;
}

export type DeclarationCategory =
  // UI related
  | "ui-component" // A presentational UI component (e.g., from shadcn/ui)
  | "page" // A page-level component (e.g., Next.js page)
  | "layout" // A component that defines page structure
  | "hook" // A React hook

  // Data and Logic
  | "api-endpoint" // A tRPC or other API endpoint definition
  | "api-client" // Client-side function to call an API
  | "service" // A backend service or class
  | "db-model" // A database table schema (e.g., Drizzle)
  | "validation-schema" // A data validation schema (e.g., Zod)
  | "domain-model" // A core data type or interface for the business logic

  // AI-specific
  | "ai-agent" // An AI agent
  | "ai-tool" // A tool for an AI agent to use
  | "ai-prompt" // A prompt for an AI model

  // General purpose
  | "utility" // A general-purpose helper function or utility
  | "config" // Configuration object or setup file
  | "type-definition" // A reusable TypeScript type that isn't a domain model

  // Other
  | "unknown"; // Category could not be determined

export interface DeclarationSemanticInfo {
  purpose: string; // One-line description
  description: string; // Detailed explanation (2-3 sentences)
  category: DeclarationCategory;
  usagePattern: {
    commonUseCases: string[]; // Typical scenarios (3-5 items)
    limitations?: string[]; // Known limitations or edge cases
    examples?: Array<{
      code: string; // Code example
      description: string; // Description of the code example
    }>;
    bestPractices?: string[]; // Best practices for using it
    antiPatterns?: string[]; // How to not use it
  };
}

export interface DeclarationData {
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
  isDefault?: boolean;
  position: DeclarationPosition;
  dependencies: Dependency[];
  uri: string;

  // Enhanced type information
  typeSignature?: string;
  typeParameters?: string[];

  // For functions
  isAsync?: boolean;
  isGenerator?: boolean;
  parameters?: Array<{
    name: string;
    type: string;
    isOptional: boolean;
    isRest: boolean;
  }>;
  returnType?: string;

  // For enums
  enumMembers?: EnumMemberInfo[];

  // For classes
  extends?: string;
  implements?: string[];
  members?: ClassMemberInfo | DeclarationData[];

  // For re-exports
  isReExport?: boolean;
  reExportSource?: string;

  // Semantic information
  semanticInfo?: DeclarationSemanticInfo;
}

export type DeclarationProgress = "pending" | "in_progress" | "completed";
export type DeclarationSpecs = z.infer<typeof declarationSpecsSchema>;
export type DeclarationSpecsV1 = z.infer<typeof declarationSpecsV1Schema>;
export type EndpointDeclarationSpecs = z.infer<
  typeof endpointDeclarationSpecsSchema
>;
export type DbModelDeclarationSpecs = z.infer<
  typeof dbModelDeclarationSpecsSchema
>;
export type PageDeclarationSpecs = z.infer<typeof pageDeclarationSpecsSchema>;
