import type { IntegrationKey } from "@weldr/shared/types";

export interface IntegrationContext {
  projectId: string;
  userId: string;
  integrationKey: IntegrationKey;
  integrationName: string;
  workspaceDir: string;
}

export interface IntegrationCallbackResult {
  success: boolean;
  message?: string;
  installedPackages?: string[];
  createdFiles?: string[];
  errors?: string[];
}

export type IntegrationCallback = () => Promise<IntegrationCallbackResult>;

export interface IntegrationDefinition {
  key: IntegrationKey;
  name: string;
  description?: string;

  // Pre-installation callback (runs before file operations)
  preInstall?: IntegrationCallback;

  // Post-installation callback (runs after file operations)
  postInstall?: IntegrationCallback;

  // Package installation callback
  installPackages?: IntegrationCallback;

  // Validation callback
  validate?: IntegrationCallback;
}
