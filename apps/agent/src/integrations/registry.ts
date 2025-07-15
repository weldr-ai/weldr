import type { WorkflowContext } from "@/workflow/context";
import type { IntegrationKey } from "@weldr/shared/types";
import { backendIntegration } from "./backend";
import { frontendIntegration } from "./frontend";
import { postgresqlIntegration } from "./postgresql";
import type { IntegrationDefinition } from "./types";
import { applyIntegrationFiles } from "./utils/integration-core";

class IntegrationRegistry {
  private integrations = new Map<IntegrationKey, IntegrationDefinition>();

  async register(integration: IntegrationDefinition): Promise<void> {
    this.integrations.set(integration.key, integration);
  }

  get(key: IntegrationKey): IntegrationDefinition | undefined {
    return this.integrations.get(key);
  }

  async install(key: IntegrationKey, context: WorkflowContext): Promise<void> {
    const integration = this.get(key);
    if (!integration) {
      throw new Error(`Integration ${key} not found`);
    }
    // Run the pre-install hook
    await integration.preInstall?.(context);
    // Apply the files
    await applyIntegrationFiles(integration, context);
    // Run the post-install hook
    await integration.postInstall?.(context);
  }

  getAll(): IntegrationDefinition[] {
    return Array.from(this.integrations.values());
  }

  has(key: IntegrationKey): boolean {
    return this.integrations.has(key);
  }

  list(): IntegrationKey[] {
    return Array.from(this.integrations.keys());
  }
}

export const integrationRegistry = new IntegrationRegistry();
integrationRegistry.register(backendIntegration);
integrationRegistry.register(frontendIntegration);
integrationRegistry.register(postgresqlIntegration);
