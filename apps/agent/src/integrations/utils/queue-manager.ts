import { and, db, eq } from "@weldr/db";
import { integrationVersions } from "@weldr/db/schema";
import { Logger } from "@weldr/shared/logger";
import type {
  Integration,
  IntegrationInstallationStatus,
} from "@weldr/shared/types";

import { integrationRegistry } from "@/integrations/utils/registry";
import type { WorkflowContext } from "@/workflow/context";

export async function processIntegrationQueue(
  context: WorkflowContext,
): Promise<void> {
  const project = context.get("project");
  const branch = context.get("branch");
  const versionId = branch.headVersionId;
  const logger = Logger.get({ projectId: project.id });

  if (!versionId) {
    logger.error("No head version found for branch");
    throw new Error("No head version found for branch");
  }

  logger.info("Processing integration queue");

  const queuedInstallations = await db.query.integrationVersions.findMany({
    where: and(
      eq(integrationVersions.versionId, versionId),
      eq(integrationVersions.status, "queued"),
    ),
    with: {
      integration: {
        with: {
          environmentVariableMappings: {
            with: {
              environmentVariable: true,
            },
          },
        },
      },
    },
  });

  if (queuedInstallations.length === 0) {
    logger.info("No queued integrations to process");
    return;
  }

  // Get completed installations for this version
  const completedInstallations = await db.query.integrationVersions.findMany({
    where: and(
      eq(integrationVersions.versionId, versionId),
      eq(integrationVersions.status, "installed"),
    ),
    with: {
      integration: true,
    },
  });

  const completedCategories = completedInstallations
    .map(
      (iv) => integrationRegistry.getIntegration(iv.integration.key)?.category,
    )
    .filter(Boolean);

  for (const installRecord of queuedInstallations) {
    const integration = installRecord.integration;
    const category = integrationRegistry.getIntegrationCategory(
      integration.key,
    );
    if (!category) {
      logger.error(`Integration definition not found: ${integration.key}`);
      throw new Error(`Integration definition not found: ${integration.key}`);
    }
    const dependencies = category.dependencies || [];
    const missingDependencies = dependencies.filter(
      (dep) => !completedCategories.includes(dep),
    );

    if (missingDependencies.length > 0) {
      await db
        .update(integrationVersions)
        .set({ status: "blocked" })
        .where(eq(integrationVersions.id, installRecord.id));

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
  const branch = context.get("branch");
  const versionId = branch.headVersionId;
  const logger = Logger.get({ projectId: project.id });

  if (!versionId) {
    logger.error("No head version found for branch");
    return;
  }

  const blockedInstallations = await db.query.integrationVersions.findMany({
    where: and(
      eq(integrationVersions.versionId, versionId),
      eq(integrationVersions.status, "blocked"),
    ),
    with: {
      integration: true,
    },
  });

  if (blockedInstallations.length === 0) {
    return;
  }

  const completedInstallations = await db.query.integrationVersions.findMany({
    where: and(
      eq(integrationVersions.versionId, versionId),
      eq(integrationVersions.status, "installed"),
    ),
    with: {
      integration: true,
    },
  });

  const completedCategories = completedInstallations
    .map(
      (iv) => integrationRegistry.getIntegration(iv.integration.key)?.category,
    )
    .filter(Boolean);

  for (const installRecord of blockedInstallations) {
    const integration = installRecord.integration;
    const category = integrationRegistry.getIntegrationCategory(
      integration.key,
    );
    const dependencies = category.dependencies || [];
    const missingDependencies = dependencies.filter(
      (dep) => !completedCategories.includes(dep),
    );

    if (missingDependencies.length === 0) {
      await db
        .update(integrationVersions)
        .set({ status: "queued" })
        .where(eq(integrationVersions.id, installRecord.id));

      logger.info(`Unblocked ${integration.key} - dependencies now satisfied`);
    }
  }
}

export async function getQueuedIntegrations(
  context: WorkflowContext,
): Promise<Integration[]> {
  const branch = context.get("branch");
  const versionId = branch.headVersionId;

  if (!versionId) {
    throw new Error("No head version found for branch");
  }

  const queuedInstallations = await db.query.integrationVersions.findMany({
    where: and(
      eq(integrationVersions.versionId, versionId),
      eq(integrationVersions.status, "queued"),
    ),
    with: {
      integration: {
        with: {
          environmentVariableMappings: {
            with: {
              environmentVariable: true,
            },
          },
        },
      },
    },
  });

  const queuedIntegrations = queuedInstallations.map(
    (iv) => iv.integration,
  ) as Integration[];

  const integrationKeys = queuedIntegrations.map((i) => i.key);
  const orderedKeys = integrationRegistry.getInstallationOrder(integrationKeys);

  return orderedKeys
    .map((key) => queuedIntegrations.find((i) => i.key === key))
    .filter(Boolean) as Integration[];
}

export async function updateIntegrationInstallationStatus(
  versionId: string,
  integrationId: string,
  status: IntegrationInstallationStatus,
): Promise<void> {
  await db
    .update(integrationVersions)
    .set({
      status,
      ...(status === "installed" ? { installedAt: new Date() } : {}),
    })
    .where(
      and(
        eq(integrationVersions.versionId, versionId),
        eq(integrationVersions.integrationId, integrationId),
      ),
    );
}
