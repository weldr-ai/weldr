import { db, eq } from "@weldr/db";
import { integrations } from "@weldr/db/schema";
import type {
  Integration,
  IntegrationCategory,
  IntegrationKey,
} from "@weldr/shared/types";
import type { WorkflowContext } from "@/workflow/context";
import { betterAuthIntegration } from "./authentication/better-auth";
import { orpcIntegration } from "./backend/orpc";
import { postgresqlIntegration } from "./database/postgresql";
import { tanstackStartIntegration } from "./frontend/tanstack-start";
import type { IntegrationDefinition } from "./types";
import { applyIntegrationFiles } from "./utils/integration-core";

function getIntegrationKeyFromCategory(
  category: IntegrationCategory,
): IntegrationKey[] {
  switch (category) {
    case "backend":
      return ["orpc"];
    case "frontend":
      return ["tanstack-start"];
    case "database":
      return ["postgresql"];
    case "authentication":
      return ["better-auth"];
    default:
      return [];
  }
}

class IntegrationRegistry {
  private integrationDefinitions = new Map<
    IntegrationKey,
    IntegrationDefinition<IntegrationKey>
  >();

  async register<K extends IntegrationKey>(
    integration: IntegrationDefinition<K>,
  ): Promise<void> {
    // biome-ignore lint/suspicious/noExplicitAny: reason
    this.integrationDefinitions.set(integration.key, integration as any);
  }

  get<K extends IntegrationKey>(key: K): IntegrationDefinition<K> {
    const integrationDefinition = this.integrationDefinitions.get(key);
    if (!integrationDefinition) {
      throw new Error(`Integration ${key} not found`);
    }
    return integrationDefinition as IntegrationDefinition<K>;
  }

  async install({
    integration,
    context,
  }: {
    integration: Integration;
    context: WorkflowContext;
  }): Promise<void> {
    const integrationDefinition = this.get(integration.key);
    if (!integrationDefinition) {
      throw new Error(`Integration ${integration.key} not found`);
    }

    // Run the pre-install hook
    await integrationDefinition.preInstall?.({ context, integration });

    // Apply the files
    await applyIntegrationFiles({
      integration,
      context,
    });

    // Run the post-install hook
    await integrationDefinition.postInstall?.({ context, integration });

    // Update the integration status
    await db
      .update(integrations)
      .set({
        status: "installed",
      })
      .where(eq(integrations.id, integration.id));
  }

  resolveInstallationOrder(
    integrationKeys: IntegrationKey[],
  ): IntegrationKey[] {
    const visited = new Set<IntegrationKey>();
    const resolved: IntegrationKey[] = [];

    const resolveDependencies = (key: IntegrationKey) => {
      if (visited.has(key)) {
        return;
      }

      visited.add(key);

      const integrationDefinition = this.get(key);
      if (!integrationDefinition) {
        return;
      }

      const dependencies = integrationDefinition.dependencies || [];

      const dependencyKeys: IntegrationKey[] = [];
      for (const category of dependencies) {
        const categoryKeys = getIntegrationKeyFromCategory(category);
        dependencyKeys.push(...categoryKeys);
      }

      for (const depKey of dependencyKeys) {
        resolveDependencies(depKey);
      }

      if (!resolved.includes(key)) {
        resolved.push(key);
      }
    };

    // Process each requested integration
    for (const key of integrationKeys) {
      resolveDependencies(key);
    }

    return resolved;
  }

  getAll(): IntegrationDefinition<IntegrationKey>[] {
    return Array.from(this.integrationDefinitions.values());
  }

  has(key: IntegrationKey): boolean {
    return this.integrationDefinitions.has(key);
  }

  list(): IntegrationKey[] {
    return Array.from(this.integrationDefinitions.keys());
  }
}

export const integrationRegistry = new IntegrationRegistry();
integrationRegistry.register(orpcIntegration);
integrationRegistry.register(tanstackStartIntegration);
integrationRegistry.register(postgresqlIntegration);
integrationRegistry.register(betterAuthIntegration);
