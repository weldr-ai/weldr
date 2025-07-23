import type { WorkflowContext } from "@/workflow/context";

import { and, db, eq } from "@weldr/db";
import { integrations } from "@weldr/db/schema";
import { Logger } from "@weldr/shared/logger";
import type { Integration } from "@weldr/shared/types";
import { integrationRegistry } from "../registry";

export async function processIntegrationQueue(
  context: WorkflowContext,
): Promise<void> {
  const project = context.get("project");
  const logger = Logger.get({ projectId: project.id });

  logger.info("Processing integration queue");

  const queuedIntegrations = await db.query.integrations.findMany({
    where: and(
      eq(integrations.projectId, project.id),
      eq(integrations.status, "queued"),
    ),
    with: {
      environmentVariableMappings: {
        with: {
          environmentVariable: true,
        },
      },
    },
  });

  if (queuedIntegrations.length === 0) {
    logger.info("No queued integrations to process");
    return;
  }

  const completedIntegrations = await db.query.integrations.findMany({
    where: and(
      eq(integrations.projectId, project.id),
      eq(integrations.status, "completed"),
    ),
  });

  const completedCategories = completedIntegrations
    .map((i) => integrationRegistry.get(i.key)?.category)
    .filter(Boolean);

  for (const integration of queuedIntegrations) {
    const integrationDefinition = integrationRegistry.get(integration.key);
    if (!integrationDefinition) {
      logger.error(`Integration definition not found: ${integration.key}`);
      continue;
    }

    const dependencies = integrationDefinition.dependencies || [];
    const missingDependencies = dependencies.filter(
      (dep) => !completedCategories.includes(dep),
    );

    if (missingDependencies.length > 0) {
      await db
        .update(integrations)
        .set({ status: "blocked" })
        .where(eq(integrations.id, integration.id));

      logger.info(
        `Blocked ${integration.key} - missing: ${missingDependencies.join(", ")}`,
      );
    }
  }

  logger.info("Queue processing completed");
}

export async function unblockIntegrations(
  context: WorkflowContext,
): Promise<void> {
  const project = context.get("project");
  const logger = Logger.get({ projectId: project.id });

  const blockedIntegrations = await db.query.integrations.findMany({
    where: and(
      eq(integrations.projectId, project.id),
      eq(integrations.status, "blocked"),
    ),
  });

  if (blockedIntegrations.length === 0) {
    return;
  }

  const completedIntegrations = await db.query.integrations.findMany({
    where: and(
      eq(integrations.projectId, project.id),
      eq(integrations.status, "completed"),
    ),
  });

  const completedCategories = completedIntegrations
    .map((i) => integrationRegistry.get(i.key)?.category)
    .filter(Boolean);

  for (const integration of blockedIntegrations) {
    const integrationDefinition = integrationRegistry.get(integration.key);
    if (!integrationDefinition) continue;

    const dependencies = integrationDefinition.dependencies || [];
    const missingDependencies = dependencies.filter(
      (dep) => !completedCategories.includes(dep),
    );

    if (missingDependencies.length === 0) {
      await db
        .update(integrations)
        .set({ status: "queued" })
        .where(eq(integrations.id, integration.id));

      logger.info(`Unblocked ${integration.key} - dependencies now satisfied`);
    }
  }
}

export async function getQueuedIntegrations(
  context: WorkflowContext,
): Promise<Integration[]> {
  const project = context.get("project");

  const queuedIntegrations = (await db.query.integrations.findMany({
    where: and(
      eq(integrations.projectId, project.id),
      eq(integrations.status, "queued"),
    ),
    with: {
      environmentVariableMappings: {
        with: {
          environmentVariable: true,
        },
      },
    },
  })) as Integration[];

  const integrationKeys = queuedIntegrations.map((i) => i.key);
  const orderedKeys = integrationRegistry.getInstallationOrder(integrationKeys);

  return orderedKeys
    .map((key) => queuedIntegrations.find((i) => i.key === key))
    .filter(Boolean) as Integration[];
}

export async function markIntegrationAsInstalling(
  integrationId: string,
): Promise<void> {
  await db
    .update(integrations)
    .set({ status: "installing" })
    .where(eq(integrations.id, integrationId));
}

export async function markIntegrationAsCompleted(
  integrationId: string,
  context: WorkflowContext,
): Promise<void> {
  await db
    .update(integrations)
    .set({ status: "completed" })
    .where(eq(integrations.id, integrationId));

  await unblockIntegrations(context);
}

export async function markIntegrationAsFailed(
  integrationId: string,
): Promise<void> {
  await db
    .update(integrations)
    .set({ status: "failed" })
    .where(eq(integrations.id, integrationId));
}
