import type { WorkflowContext } from "@/workflow/context";

import { Logger } from "@weldr/shared/logger";
import type {
  Integration,
  IntegrationKey,
  IntegrationStatus,
} from "@weldr/shared/types";
import { integrationRegistry } from "../registry";

export async function installIntegrations(
  integrations: Integration[],
  context: WorkflowContext,
) {
  const addedIntegrations: {
    id: string;
    key: IntegrationKey;
    status: IntegrationStatus;
  }[] = [];
  for (const integration of integrations) {
    if (integration.status === "completed") {
      continue;
    }

    try {
      await integrationRegistry.install({
        integration,
        context,
      });
      Logger.info(`Installed ${integration.key} integration`);
      addedIntegrations.push({
        id: integration.id,
        key: integration.key,
        status: "completed",
      });
    } catch (error) {
      Logger.error(`Failed to apply ${integration.key} integration`, {
        extra: { error },
      });
      const errorMessage = `Failed to apply ${integration.key} integration: ${error instanceof Error ? error.message : "Unknown error"}`;
      return { status: "error" as const, error: errorMessage };
    }
  }
  return { status: "completed" as const, addedIntegrations };
}
