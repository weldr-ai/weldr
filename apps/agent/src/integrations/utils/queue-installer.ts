import { getSSEConnection } from "@/lib/utils";
import type { WorkflowContext } from "@/workflow/context";

import { and, db, eq } from "@weldr/db";
import { chatMessages, integrations } from "@weldr/db/schema";
import { Logger } from "@weldr/shared/logger";
import type {
  IntegrationCategoryKey,
  IntegrationKey,
  IntegrationStatus,
  ToolMessage,
  ToolResultPartMessage,
} from "@weldr/shared/types";
import { integrationRegistry } from "../registry";
import {
  getQueuedIntegrations,
  updateIntegrationStatus,
} from "./queue-manager";

async function streamToolMessageUpdate({
  context,
  integrationId,
  status,
}: {
  context: WorkflowContext;
  integrationId: string;
  status: "installing" | "completed" | "failed";
}) {
  const version = context.get("version");

  const streamWriter = getSSEConnection(version.chatId);

  const integration = await db.query.integrations.findFirst({
    where: eq(integrations.id, integrationId),
  });

  if (!integration) {
    return;
  }

  const message = await db.query.chatMessages.findFirst({
    where: and(
      eq(chatMessages.chatId, version.chatId),
      eq(chatMessages.role, "tool"),
    ),
    orderBy: (chatMessages, { desc }) => [desc(chatMessages.createdAt)],
  });

  if (!message) {
    return;
  }

  const toolMessage = message as ToolMessage;

  const toolContent = toolMessage.content[0] as ToolResultPartMessage;

  const toolOutput = toolContent.output as {
    status: "awaiting_config" | "success" | "cancelled" | "failed";
    categories: IntegrationCategoryKey[];
    integrations?: {
      category: IntegrationCategoryKey;
      key: IntegrationKey;
      name: string;
      status: IntegrationStatus;
    }[];
  };

  const existingIntegrations = toolOutput.integrations || [];
  const updatedIntegrations = existingIntegrations.map(
    (existingIntegration: {
      category: IntegrationCategoryKey;
      key: IntegrationKey;
      name: string;
      status: IntegrationStatus;
    }) =>
      existingIntegration.key === integration.key
        ? { ...existingIntegration, status }
        : existingIntegration,
  );

  const updatedContent = [
    {
      type: "tool-result",
      toolCallId: toolContent.toolCallId,
      toolName: toolContent.toolName,
      output: {
        ...toolOutput,
        integrations: updatedIntegrations,
      },
    } satisfies ToolResultPartMessage,
  ];

  await db
    .update(chatMessages)
    .set({
      content: updatedContent,
    })
    .where(eq(chatMessages.id, message.id));

  await streamWriter.write({
    type: "tool",
    message: {
      ...toolMessage,
      content: updatedContent,
    },
  });
}

export async function installQueuedIntegrations(
  context: WorkflowContext,
): Promise<
  | {
      status: "completed";
      installedIntegrations: {
        id: string;
        key: IntegrationKey;
        status: IntegrationStatus;
      }[];
    }
  | {
      status: "error";
      error: string;
    }
> {
  const project = context.get("project");
  const logger = Logger.get({ projectId: project.id });

  logger.info("Starting installation of queued integrations");

  const allInstalledIntegrations: {
    id: string;
    key: IntegrationKey;
    status: IntegrationStatus;
  }[] = [];

  let installationRound = 1;

  while (true) {
    const queuedIntegrations = await getQueuedIntegrations(context);

    if (queuedIntegrations.length === 0) {
      logger.info(
        `Installation round ${installationRound}: No queued integrations found`,
      );
      break;
    }

    logger.info(
      `Installation round ${installationRound}: Found ${queuedIntegrations.length} queued integrations`,
    );

    let installedInThisRound = 0;

    for (const integration of queuedIntegrations) {
      try {
        await updateIntegrationStatus(integration.id, "installing");
        logger.info(`Started installing ${integration.key}`);

        await streamToolMessageUpdate({
          context,
          integrationId: integration.id,
          status: "installing",
        });

        await integrationRegistry.install({
          integration,
          context,
        });

        await updateIntegrationStatus(integration.id, "completed");
        logger.info(`Successfully installed ${integration.key}`);

        allInstalledIntegrations.push({
          id: integration.id,
          key: integration.key,
          status: "completed",
        });

        installedInThisRound++;

        await streamToolMessageUpdate({
          context,
          integrationId: integration.id,
          status: "completed",
        });
      } catch (error) {
        logger.error(`Failed to install ${integration.key}`, {
          extra: { error },
        });

        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        await updateIntegrationStatus(integration.id, "failed");

        await streamToolMessageUpdate({
          context,
          integrationId: integration.id,
          status: "failed",
        });

        const fullError = `Failed to install ${integration.key}: ${errorMessage}`;
        return {
          status: "error",
          error: fullError,
        };
      }
    }

    logger.info(
      `Installation round ${installationRound}: Installed ${installedInThisRound} integrations`,
    );

    if (installedInThisRound === 0) {
      logger.info("No integrations installed in this round, stopping");
      break;
    }

    installationRound++;
  }

  logger.info(
    `Successfully installed ${allInstalledIntegrations.length} integrations across ${installationRound - 1} rounds`,
  );

  return {
    status: "completed",
    installedIntegrations: allInstalledIntegrations,
  };
}
