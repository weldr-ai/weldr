import type { WorkflowContext } from "@/workflow/context";

import { and, db, eq } from "@weldr/db";
import { integrations } from "@weldr/db/schema";
import { Logger } from "@weldr/shared/logger";
import type { Integration, IntegrationKey } from "@weldr/shared/types";
import { integrationRegistry } from "../registry";
import { processIntegrationQueue } from "./queue-manager";

export async function createIntegrations(
  keys: IntegrationKey[],
  context: WorkflowContext,
): Promise<Integration[]> {
  const project = context.get("project");
  const user = context.get("user");
  const logger = Logger.get({ projectId: project.id });

  logger.info(`Creating integrations: ${keys.join(", ")}`);

  const createdIntegrations: Integration[] = [];

  await db.transaction(async (tx) => {
    for (const key of keys) {
      const integrationDefinition = integrationRegistry.get(key);
      if (!integrationDefinition) {
        throw new Error(`Integration definition not found: ${key}`);
      }

      const integrationTemplate = await tx.query.integrationTemplates.findFirst(
        {
          where: (t, { eq }) => eq(t.key, key),
        },
      );

      if (!integrationTemplate) {
        throw new Error(`Integration template not found: ${key}`);
      }

      const existingIntegration = await tx.query.integrations.findFirst({
        where: (t, { eq }) =>
          and(
            eq(t.projectId, project.id),
            eq(t.integrationTemplateId, integrationTemplate.id),
          ),
        with: {
          environmentVariableMappings: {
            with: {
              environmentVariable: true,
            },
          },
        },
      });

      if (existingIntegration && !integrationDefinition.allowMultiple) {
        logger.info(`Integration ${key} already exists, skipping creation`);
        createdIntegrations.push(existingIntegration as Integration);
        continue;
      }

      const requiresConfiguration = integrationDefinition.variables?.some(
        (v) => v.source === "user" && v.isRequired,
      );

      if (requiresConfiguration) {
        const [integration] = await tx
          .insert(integrations)
          .values({
            key,
            category: integrationTemplate.category,
            projectId: project.id,
            userId: user.id,
            integrationTemplateId: integrationTemplate.id,
            status: "awaiting_config",
          })
          .returning();

        if (!integration) {
          throw new Error(`Failed to create integration: ${key}`);
        }

        logger.info(`Created integration ${key} with status awaiting_config`);

        createdIntegrations.push({
          ...integration,
          environmentVariableMappings: [],
        } as Integration);
      } else {
        const [integration] = await tx
          .insert(integrations)
          .values({
            key,
            category: integrationTemplate.category,
            projectId: project.id,
            userId: user.id,
            integrationTemplateId: integrationTemplate.id,
            status: "queued",
          })
          .returning();

        if (!integration) {
          throw new Error(`Failed to create integration: ${key}`);
        }

        logger.info(`Created integration ${key} with status queued`);

        createdIntegrations.push({
          ...integration,
          environmentVariableMappings: [],
        } as Integration);
      }
    }
  });

  await processIntegrationQueue(context);

  const updatedIntegrations = await Promise.all(
    createdIntegrations.map(async (integration) => {
      const updated = await db.query.integrations.findFirst({
        where: eq(integrations.id, integration.id),
        with: {
          environmentVariableMappings: {
            with: {
              environmentVariable: true,
            },
          },
        },
      });
      return updated as Integration;
    }),
  );

  return updatedIntegrations;
}
