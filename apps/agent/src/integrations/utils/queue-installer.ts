import type { ToolContent, ToolResultPart } from "ai";

import { and, db, eq } from "@weldr/db";
import { chatMessages, integrations } from "@weldr/db/schema";
import { Logger } from "@weldr/shared/logger";
import type {
  IntegrationCategoryKey,
  IntegrationKey,
  IntegrationStatus,
  ToolMessage,
} from "@weldr/shared/types";

import { integrationRegistry } from "@/integrations/utils/registry";
import { stream } from "@/lib/stream-utils";
import type { WorkflowContext } from "@/workflow/context";
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
  const branch = context.get("branch");

  const integration = await db.query.integrations.findFirst({
    where: eq(integrations.id, integrationId),
  });

  if (!integration) {
    return;
  }

  const message = await db.query.chatMessages.findFirst({
    where: and(
      eq(chatMessages.chatId, branch.headVersion.chatId),
      eq(chatMessages.role, "tool"),
    ),
    orderBy: (chatMessages, { desc }) => [desc(chatMessages.createdAt)],
  });

  if (!message) {
    return;
  }

  const toolMessage = message as ToolMessage;

  const toolResultPart = toolMessage.content[0] as ToolResultPart;

  const toolOutput = toolResultPart.output as {
    type: "json";
    value: {
      status: "awaiting_config" | "success" | "cancelled" | "failed";
      categories: IntegrationCategoryKey[];
      integrations?: {
        category: IntegrationCategoryKey;
        key: IntegrationKey;
        name: string;
        status: IntegrationStatus;
      }[];
    };
  };

  const updatedIntegrations = toolOutput.value.integrations?.map(
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
      toolCallId: toolResultPart.toolCallId,
      toolName: toolResultPart.toolName,
      output: {
        type: "json",
        value: {
          status: "completed",
          categories: toolOutput.value.categories,
          integrations: updatedIntegrations,
        },
      },
    },
  ] as ToolContent;

  await db
    .update(chatMessages)
    .set({
      content: updatedContent,
    })
    .where(eq(chatMessages.id, message.id));

  await stream(branch.headVersion.chatId, {
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
