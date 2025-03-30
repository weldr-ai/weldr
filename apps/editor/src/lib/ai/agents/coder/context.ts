import type { InferSelectModel } from "@weldr/db";
import type { packages } from "@weldr/db/schema";
import type { declarationMetadataSchema } from "@weldr/shared/validators/declarations/index";
import type { z } from "zod";

export function getFilesContext({
  files: availableFiles,
}: {
  files: {
    path: string;
    declarations: {
      metadata: z.infer<typeof declarationMetadataSchema>;
      dependencies: {
        dependency: {
          file: {
            path: string;
          };
          metadata: z.infer<typeof declarationMetadataSchema>;
        };
      }[];
      dependents: {
        dependent: {
          file: {
            path: string;
          };
          metadata: z.infer<typeof declarationMetadataSchema>;
        };
      }[];
    }[];
  }[];
}): string {
  const declarationName = (
    declarationMetadata: z.infer<typeof declarationMetadataSchema>,
  ) => {
    switch (declarationMetadata.type) {
      case "endpoint":
        return declarationMetadata.definition.subtype === "rest"
          ? `${declarationMetadata.definition.method.toUpperCase()} ${declarationMetadata.definition.path}`
          : `RPC ${declarationMetadata.definition.name}`;
      case "component":
        return declarationMetadata.definition.name;
      case "function":
      case "model":
      case "other":
        return declarationMetadata.name;
    }
  };

  const groupedDependencies = (
    dependencies: {
      dependency: {
        file: {
          path: string;
        };
        metadata: z.infer<typeof declarationMetadataSchema>;
      };
    }[],
  ) => {
    return dependencies.reduce<Record<string, string[]>>((acc, dependency) => {
      const key = dependency.dependency.file.path;
      if (!key) return acc;
      acc[key] = [
        ...(acc[key] || []),
        declarationName(dependency.dependency.metadata),
      ];
      return acc;
    }, {});
  };

  const groupedDependents = (
    dependents: {
      dependent: {
        file: {
          path: string;
        };
        metadata: z.infer<typeof declarationMetadataSchema>;
      };
    }[],
  ) => {
    return dependents.reduce<Record<string, string[]>>((acc, dependent) => {
      const key = dependent.dependent.file.path;
      if (!key) return acc;
      acc[key] = [
        ...(acc[key] || []),
        declarationName(dependent.dependent.metadata),
      ];
      return acc;
    }, {});
  };

  return `
  ### Available files
  ${availableFiles
    .map(
      (file) =>
        `- ${file.path}
  ${file.declarations
    .map((declaration) => {
      const metadata = declaration.metadata;
      if (!metadata) return "";

      switch (metadata.type) {
        case "endpoint": {
          const def = metadata.definition;
          if (def.subtype === "rest") {
            let info = `  • REST Endpoint: ${def.method.toUpperCase()} ${def.path}
  Summary: ${def.summary || "No summary"}
  ${def.description ? `  Description: ${def.description}` : ""}`;

            if (declaration.dependencies.length > 0) {
              info += `\n  Depends on: ${groupedDependencies(declaration.dependencies)}`;
            }

            if (declaration.dependents.length > 0) {
              info += `\n  Used by: ${groupedDependents(declaration.dependents)}`;
            }

            return info;
          }
          let info = `  • RPC: ${def.name}
  Description: ${def.description}
  Parameters: ${def.parameters ? JSON.stringify(def.parameters) : "None"}
  Returns: ${def.returns ? JSON.stringify(def.returns) : "void"}`;

          if (declaration.dependencies.length > 0) {
            info += `\n  Depends on: ${groupedDependencies(declaration.dependencies)}`;
          }

          if (declaration.dependents.length > 0) {
            info += `\n  Used by: ${groupedDependents(declaration.dependents)}`;
          }

          return info;
        }

        case "component": {
          const def = metadata.definition;
          let info = `  • ${def.subtype === "page" ? "Page" : def.subtype === "layout" ? "Layout" : "Component"}: ${def.name}
      Description: ${def.description}
      Renders on: ${def.rendersOn || "both"}`;

          if (def.subtype === "page" || def.subtype === "layout") {
            info += def.route ? `\n  Route: ${def.route}` : "";
          }

          if (def.properties) {
            info += `\n  Props: ${JSON.stringify(def.properties)}`;
          }

          if (declaration.dependencies.length > 0) {
            info += `\n  Depends on: ${groupedDependencies(declaration.dependencies)}`;
          }

          if (declaration.dependents.length > 0) {
            info += `\n  Used by: ${groupedDependents(declaration.dependents)}`;
          }

          return info;
        }

        case "function": {
          let info = `  • Function: ${metadata.name}
      Description: ${metadata.description}
      ${metadata.parameters ? `Parameters: ${JSON.stringify(metadata.parameters)}` : ""}
      ${metadata.returns ? `Returns: ${JSON.stringify(metadata.returns)}` : ""}`;

          if (declaration.dependencies.length > 0) {
            info += `\n  Depends on: ${groupedDependencies(declaration.dependencies)}`;
          }

          return info;
        }

        case "model": {
          let info = `  • Model: ${metadata.name}
  Columns: ${metadata.columns.map((col) => `${col.name} (${col.type})`).join(", ")}
  ${metadata.relationships ? `Relations: ${metadata.relationships.length} defined` : ""}`;

          if (declaration.dependencies.length > 0) {
            info += `\n  Depends on: ${groupedDependencies(declaration.dependencies)}`;
          }

          if (declaration.dependents.length > 0) {
            info += `\n  Used by: ${groupedDependents(declaration.dependents)}`;
          }

          return info;
        }

        case "other": {
          let info = `  • ${metadata.declType}: ${metadata.name}
  Description: ${metadata.description}`;

          if (declaration.dependencies.length > 0) {
            info += `\n  Depends on: ${groupedDependencies(declaration.dependencies)}`;
          }

          if (declaration.dependents.length > 0) {
            info += `\n  Used by: ${groupedDependents(declaration.dependents)}`;
          }

          return info;
        }

        default:
          return null;
      }
    })
    .filter(Boolean)
    .join("\n")}`,
    )
    .filter(Boolean)
    .join("\n\n")}
  `;
}

export function getFolderContext({
  files,
}: {
  files: {
    path: string;
  }[];
}): string {
  return `### Current Folder Structure
  ${files.map((file) => `  - ${file.path}`).join("\n")}`;
}

export function getInstalledPackages({
  pkgs,
}: {
  pkgs: Omit<InferSelectModel<typeof packages>, "id" | "projectId">[];
}): string {
  const runtimePkgs = pkgs.filter((pkg) => pkg.type === "runtime");
  const devPkgs = pkgs.filter((pkg) => pkg.type === "development");
  return `### Current Installed Packages
  - Runtime packages:
  ${runtimePkgs.map((pkg) => `  - ${pkg.name}`).join("\n")}
  - Development packages:
  ${devPkgs.map((pkg) => `  - ${pkg.name}`).join("\n")}`;
}
