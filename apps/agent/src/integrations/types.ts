import type { WorkflowContext } from "@/workflow/context";
import type { IntegrationKey } from "@weldr/shared/types";

export interface IntegrationCallbackResult {
  success: boolean;
  message?: string;
  installedPackages?: string[];
  createdFiles?: string[];
  errors?: string[];
}

export type FileItem =
  | {
      type: "copy" | "llm_instruction";
      path: string;
      content: string;
    }
  | {
      type: "handlebars";
      path: string;
      template: string;
      variables: Record<string, string>;
    };

export type IntegrationCallback = (
  context: WorkflowContext,
) => Promise<IntegrationCallbackResult>;

export interface IntegrationDefinition {
  key: IntegrationKey;
  name: string;
  description?: string;
  dirMap?: {
    "standalone-backend"?: Record<string, string>;
    "standalone-frontend"?: Record<string, string>;
  };

  packages?: {
    add: {
      runtime?: Record<string, string>;
      development?: Record<string, string>;
    };
    remove?: string[];
  };

  scripts?: Record<string, string>;

  // Get the files for the integration
  files: FileItem[];

  // Pre-installation callback (runs before file operations)
  preInstall?: IntegrationCallback;

  // Post-installation callback (runs after file operations)
  postInstall?: IntegrationCallback;
}
