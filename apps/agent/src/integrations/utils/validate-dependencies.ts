import type { WorkflowContext } from "@/workflow/context";

import { and, db, eq } from "@weldr/db";
import { integrations } from "@weldr/db/schema";
import type { IntegrationCategory, IntegrationKey } from "@weldr/shared/types";
import { integrationRegistry } from "../registry";

export interface DependencyInfo {
  integrationKey: IntegrationKey;
  dependencies: IntegrationCategory[];
  satisfiedDependencies: IntegrationCategory[];
  missingDependencies: IntegrationCategory[];
  isReady: boolean;
}

export interface ProjectIntegrationStatus {
  completedCategories: IntegrationCategory[];
  availableIntegrations: DependencyInfo[];
  readyToInstall: IntegrationKey[];
  blocked: IntegrationKey[];
}

/**
 * Validates dependencies considering existing completed integrations in the database
 */
export async function validateDependencies(
  integrationKeys: IntegrationKey[],
  context: WorkflowContext,
): Promise<{
  isValid: boolean;
  missingDependencies: IntegrationCategory[];
  errors: string[];
}> {
  const project = context.get("project");
  const errors: string[] = [];

  // Get existing completed integrations from database
  const completedIntegrations = await db.query.integrations.findMany({
    where: and(
      eq(integrations.projectId, project.id),
      eq(integrations.status, "completed"),
    ),
  });

  const completedCategories = new Set(
    completedIntegrations
      .map((i) => integrationRegistry.get(i.key)?.category)
      .filter(Boolean) as IntegrationCategory[],
  );

  const allRequiredCategories = new Set<IntegrationCategory>();
  const providedCategories = new Set(completedCategories);

  // Collect required dependencies and provided categories from new integrations
  for (const key of integrationKeys) {
    const integrationDefinition = integrationRegistry.get(key);

    if (!integrationDefinition) {
      errors.push(`Integration definition not found: ${key}`);
      continue;
    }

    // Add the category this integration provides
    providedCategories.add(integrationDefinition.category);

    // Add all dependencies this integration requires
    const dependencies = integrationDefinition.dependencies || [];
    dependencies.forEach((dep) => allRequiredCategories.add(dep));
  }

  // Check if all required dependencies are satisfied (including existing ones)
  const missingDependencies = Array.from(allRequiredCategories).filter(
    (dep) => !providedCategories.has(dep),
  );

  if (missingDependencies.length > 0) {
    errors.push(
      `Missing required integrations for categories: ${missingDependencies.join(", ")}`,
    );
  }

  return {
    isValid: errors.length === 0,
    missingDependencies,
    errors,
  };
}
