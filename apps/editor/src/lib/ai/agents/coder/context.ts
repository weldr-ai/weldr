import type { declarationSpecsSchema } from "@weldr/shared/validators/declarations/index";
import type { z } from "zod";

export function getFilesContext({
  files: availableFiles,
}: {
  files: {
    path: string;
    declarations: {
      specs: z.infer<typeof declarationSpecsSchema>;
      dependencies: {
        dependency: {
          file: {
            path: string;
          };
          specs: z.infer<typeof declarationSpecsSchema>;
        };
      }[];
      dependents: {
        dependent: {
          file: {
            path: string;
          };
          specs: z.infer<typeof declarationSpecsSchema>;
        };
      }[];
    }[];
  }[];
}): string {
  const declarationName = (
    declarationSpecs: z.infer<typeof declarationSpecsSchema>,
  ) => {
    switch (declarationSpecs.data.type) {
      case "endpoint":
        return `${declarationSpecs.data.definition.method.toUpperCase()} ${declarationSpecs.data.definition.path}`;
      case "component":
        return declarationSpecs.data.definition.name;
      case "function":
      case "model":
      case "other":
        return declarationSpecs.data.name;
    }
  };

  const groupedDependencies = (
    dependencies: {
      dependency: {
        file: {
          path: string;
        };
        specs: z.infer<typeof declarationSpecsSchema>;
      };
    }[],
  ) => {
    return dependencies.reduce<Record<string, string[]>>((acc, dependency) => {
      const key = dependency.dependency.file.path;
      if (!key) return acc;
      acc[key] = [
        ...(acc[key] || []),
        declarationName(dependency.dependency.specs),
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
        specs: z.infer<typeof declarationSpecsSchema>;
      };
    }[],
  ) => {
    return dependents.reduce<Record<string, string[]>>((acc, dependent) => {
      const key = dependent.dependent.file.path;
      if (!key) return acc;
      acc[key] = [
        ...(acc[key] || []),
        declarationName(dependent.dependent.specs),
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
      const specs = declaration.specs;
      if (!specs) return "";

      switch (specs.data.type) {
        case "endpoint": {
          const def = specs.data.definition;
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

        case "component": {
          const def = specs.data.definition;
          let info = `  • ${def.subtype === "page" ? "Page" : def.subtype === "layout" ? "Layout" : "Component"}: ${def.name}
      Description: ${def.description}`;

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
          let info = `  • Function: ${specs.data.name}
      Description: ${specs.data.description}
      ${specs.data.parameters ? `Parameters: ${JSON.stringify(specs.data.parameters)}` : ""}
      ${specs.data.returns ? `Returns: ${JSON.stringify(specs.data.returns)}` : ""}`;

          if (declaration.dependencies.length > 0) {
            info += `\n  Depends on: ${groupedDependencies(declaration.dependencies)}`;
          }

          return info;
        }

        case "model": {
          let info = `  • Model: ${specs.data.name}
  Columns: ${specs.data.columns.map((col) => `${col.name} (${col.type})`).join(", ")}
  ${specs.data.relationships ? `Relations: ${specs.data.relationships.length} defined` : ""}`;

          if (declaration.dependencies.length > 0) {
            info += `\n  Depends on: ${groupedDependencies(declaration.dependencies)}`;
          }

          if (declaration.dependents.length > 0) {
            info += `\n  Used by: ${groupedDependents(declaration.dependents)}`;
          }

          return info;
        }

        case "other": {
          let info = `  • ${specs.data.declType}: ${specs.data.name}
  Description: ${specs.data.description}`;

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

export function getFolderStructure({
  files,
}: {
  files: {
    path: string;
  }[];
}): string {
  return `### Current Folder Structure
  ${files.map((file) => `  - ${file.path}`).join("\n")}`;
}
