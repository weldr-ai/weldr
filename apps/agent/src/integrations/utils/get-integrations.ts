import type { WorkflowContext } from "@/workflow/context";

import { and, db } from "@weldr/db";
import { integrations } from "@weldr/db/schema";
import { Logger } from "@weldr/shared/logger";
import type { Integration, IntegrationKey } from "@weldr/shared/types";
import { integrationRegistry } from "../registry";

export async function getIntegrations(input: {
  keys: IntegrationKey[];
  context: WorkflowContext;
}): Promise<Integration[]> {
  const project = input.context.get("project");
  const user = input.context.get("user");
  Logger.info(`Resolved dependencies: ${input.keys.join(", ")}`);

  const integrationsToInstall: Integration[] = [];

  await db.transaction(async (tx) => {
    for (const key of input.keys) {
      const integrationDefinition = integrationRegistry.get(key);

      const integrationTemplate = await tx.query.integrationTemplates.findFirst(
        {
          where: (t, { eq }) => eq(t.key, key),
        },
      );

      if (!integrationTemplate) {
        throw new Error(`Integration template not found: ${key}`);
      }

      const doesIntegrationExist = await tx.query.integrations.findFirst({
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

      if (
        doesIntegrationExist &&
        integrationDefinition.allowMultiple === false
      ) {
        integrationsToInstall.push(doesIntegrationExist as Integration);
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
            status: "requires_configuration",
          })
          .returning();

        if (!integration) {
          throw new Error(`Failed to create integration: ${key}`);
        }

        integrationsToInstall.push({
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
            status: "ready",
            integrationTemplateId: integrationTemplate.id,
          })
          .returning();

        if (!integration) {
          throw new Error(`Failed to create integration: ${key}`);
        }

        integrationsToInstall.push({
          ...integration,
          environmentVariableMappings: [],
        } as Integration);
      }
    }
  });

  return integrationsToInstall;
}
