import { useMutation } from "@tanstack/react-query";
import fastDeepEqual from "fast-deep-equal";
import { CheckIcon, LoaderIcon, PenIcon } from "lucide-react";
import {
  type Dispatch,
  memo,
  type SetStateAction,
  useCallback,
  useState,
} from "react";
import { useProject } from "@/lib/context/project";
import { useTRPC } from "@/lib/trpc/react";

import type { RouterOutputs } from "@weldr/api";
import type {
  ChatMessage,
  IntegrationCategoryKey,
  TPendingMessage,
} from "@weldr/shared/types";
import { Button } from "@weldr/ui/components/button";
import { ConfigurationDialog } from "./configuration-dialog";
import { IntegrationsCombobox } from "./integrations-combobox";
import type {
  IntegrationToolMessage,
  IntegrationToolResultPart,
} from "./types";

const PureSetupIntegration = ({
  message,
  setMessages,
  integrationTemplates,
  environmentVariables,
  setPendingMessage,
}: {
  message: ChatMessage;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  integrationTemplates: RouterOutputs["integrationTemplates"]["list"];
  environmentVariables: RouterOutputs["environmentVariables"]["list"];
  setPendingMessage: Dispatch<SetStateAction<TPendingMessage>>;
}) => {
  const { project } = useProject();
  const trpc = useTRPC();

  const requiredCategories = (message.content[0] as IntegrationToolResultPart)
    .output.categories;

  const [selectedIntegrations, setSelectedIntegrations] = useState<
    Record<string, RouterOutputs["integrationTemplates"]["list"][0] | null>
  >(
    integrationTemplates.reduce(
      (acc, template) => {
        if (
          template.isRecommended &&
          requiredCategories.includes(template.category.key)
        ) {
          acc[template.category.key] = template;
        }
        return acc;
      },
      {} as Record<
        string,
        RouterOutputs["integrationTemplates"]["list"][0] | null
      >,
    ),
  );

  const [categoryChange, setCategoryChange] = useState<
    IntegrationCategoryKey[]
  >([]);

  const [configuredIntegrations, setConfiguredIntegrations] = useState<
    Record<
      string,
      {
        template: RouterOutputs["integrationTemplates"]["list"][0];
        name?: string;
        environmentVariableMappings: Record<string, string>;
        isConfigured: boolean;
      }
    >
  >({});

  const filteredIntegrationTemplates = integrationTemplates.filter(
    (template) =>
      requiredCategories.length === 0 ||
      requiredCategories.includes(template.category.key),
  );

  const groupedTemplates = filteredIntegrationTemplates.reduce(
    (acc, template) => {
      const categoryKey = template.category.key;
      if (!acc[categoryKey]) {
        acc[categoryKey] = {
          category: template.category,
          templates: [],
        };
      }
      acc[categoryKey].templates.push(template);
      return acc;
    },
    {} as Record<
      string,
      {
        category: RouterOutputs["integrationTemplates"]["list"][0]["category"];
        templates: RouterOutputs["integrationTemplates"]["list"];
      }
    >,
  );

  const createBatchIntegrationsMutation = useMutation(
    trpc.integrations.createBatch.mutationOptions(),
  );

  const handleSelectIntegration = (
    categoryKey: string,
    integration: RouterOutputs["integrationTemplates"]["list"][0],
  ) => {
    setSelectedIntegrations((prev) => ({
      ...prev,
      [categoryKey]: integration,
    }));

    const existingIntegrationId = Object.keys(configuredIntegrations).find(
      (id) => configuredIntegrations[id]?.template.category.key === categoryKey,
    );
    if (existingIntegrationId) {
      setConfiguredIntegrations((prev) => {
        const newState = { ...prev };
        delete newState[existingIntegrationId];
        return newState;
      });
    }

    const variables = integration.variables || [];
    const needsConfig =
      variables.length > 0 && variables.some((v) => v.source === "user");

    if (!needsConfig) {
      setConfiguredIntegrations((prev) => ({
        ...prev,
        [integration.id]: {
          template: integration,
          name: integration.name,
          environmentVariableMappings: {},
          isConfigured: true,
        },
      }));
    }
  };

  const handleEnvironmentVariableMapping = (
    templateId: string,
    configKey: string,
    envVarId: string,
  ) => {
    setConfiguredIntegrations((prev) => {
      const existingIntegration = prev[templateId] || {
        // biome-ignore lint/style/noNonNullAssertion: reason
        template: filteredIntegrationTemplates.find(
          (t) => t.id === templateId,
        )!,
        name: filteredIntegrationTemplates.find((t) => t.id === templateId)
          ?.name,
        environmentVariableMappings: {},
        isConfigured: false,
      };

      return {
        ...prev,
        [templateId]: {
          ...existingIntegration,
          environmentVariableMappings: {
            ...existingIntegration.environmentVariableMappings,
            [configKey]: envVarId,
          },
        },
      };
    });
  };

  const needsUserConfig = useCallback(
    (categoryKey: string): boolean => {
      const integration = selectedIntegrations[categoryKey];
      if (!integration) return false;
      const variables = integration.variables || [];
      return variables.length > 0 && variables.some((v) => v.source === "user");
    },
    [selectedIntegrations],
  );

  const isConfigured = useCallback(
    (categoryKey: string): boolean => {
      const integration = selectedIntegrations[categoryKey];
      if (!integration) return false;

      const variables = integration.variables || [];

      if (variables.length === 0) return true;

      if (variables.every((v) => v.source === "system")) return true;

      const configuredIntegration = configuredIntegrations[integration.id];
      const mappings = configuredIntegration?.environmentVariableMappings || {};

      return variables
        .filter((v) => v.source === "user")
        .every((v) => mappings[v.name]);
    },
    [selectedIntegrations, configuredIntegrations],
  );

  const handleConfigurationConfirm = (templateId: string) => {
    setConfiguredIntegrations((prev) => {
      const existingIntegration = prev[templateId];
      if (!existingIntegration) return prev;

      return {
        ...prev,
        [templateId]: {
          ...existingIntegration,
          isConfigured: true,
        },
      };
    });
  };

  const handleConfigurationCancel = (templateId: string) => {
    setConfiguredIntegrations((prev) => {
      const newState = { ...prev };
      delete newState[templateId];
      return newState;
    });
  };

  const updateMessageMutation = useMutation(
    trpc.chats.updateToolMessage.mutationOptions(),
  );

  const handleFinalConfirm = useCallback(async () => {
    const configurations = Object.values(selectedIntegrations)
      .filter(
        (integration): integration is NonNullable<typeof integration> =>
          integration !== null && isConfigured(integration.category.key),
      )
      .map((integration) => {
        const configuredIntegration = configuredIntegrations[integration.id];
        return {
          name: configuredIntegration?.name || integration.name,
          integrationTemplateId: integration.id,
          category: integration.category.key,
          integrationKey: integration.key,
          environmentVariableMappings: Object.entries(
            configuredIntegration?.environmentVariableMappings || {},
          ).map(([configKey, envVarId]) => ({
            configKey,
            envVarId,
          })),
        };
      });

    const lastMessage = message as IntegrationToolMessage;
    const toolResult = lastMessage?.content[0] as IntegrationToolResultPart;
    const newMessage = {
      ...lastMessage,
      content: [
        {
          ...toolResult,
          output: {
            ...toolResult.output,
            status: "completed" as const,
            integrations: configurations.map((config) => ({
              category: config.category,
              key: config.integrationKey,
              name: config.name,
              status: "queued",
            })),
          },
        },
      ],
    } as IntegrationToolMessage;

    setMessages((prev) => {
      const newMessages = [...prev];
      newMessages.pop();
      newMessages.push(newMessage);
      return newMessages;
    });

    updateMessageMutation.mutate({
      where: {
        messageId: message.id,
      },
      data: {
        content: newMessage.content,
      },
    });

    await createBatchIntegrationsMutation.mutateAsync({
      projectId: project.id,
      triggerWorkflow: true,
      integrations: configurations,
    });

    setPendingMessage("thinking");
  }, [
    project,
    setPendingMessage,
    createBatchIntegrationsMutation,
    configuredIntegrations,
    setMessages,
    updateMessageMutation,
    message,
    selectedIntegrations,
    isConfigured,
  ]);

  const handleIntegrationCancel = useCallback(() => {
    setPendingMessage(null);
    const lastMessage = message as IntegrationToolMessage;
    const newMessage = {
      ...lastMessage,
      content: lastMessage.content.map((content) => {
        if (content.type === "tool-result") {
          return {
            ...content,
            output: {
              ...(content.output as {
                status: "cancelled";
                categories: IntegrationCategoryKey[];
              }),
              status: "cancelled",
            },
          };
        }
        return content;
      }),
    } as IntegrationToolMessage;

    setMessages((prev) => {
      const newMessages = [...prev];
      newMessages.pop();
      newMessages.push(newMessage);
      return newMessages;
    });

    updateMessageMutation.mutate({
      where: {
        messageId: message.id,
      },
      data: {
        content: newMessage.content,
      },
    });
  }, [setMessages, setPendingMessage, updateMessageMutation, message]);

  return (
    <div className="flex min-h-[300px] flex-col">
      <div className="flex flex-col items-center border-b p-1.5">
        <h3 className="font-medium">Setup Integrations</h3>
        <p className="text-muted-foreground text-xs">
          Select and configure integrations for your project
        </p>
      </div>
      <div className="flex flex-1 flex-col justify-between gap-2 p-1.5">
        {Object.entries(groupedTemplates)
          .sort(([, a], [, b]) => {
            const aNeedsConfig = needsUserConfig(a.category.key);
            const bNeedsConfig = needsUserConfig(b.category.key);
            if (aNeedsConfig && !bNeedsConfig) return -1;
            if (!aNeedsConfig && bNeedsConfig) return 1;
            return 0;
          })
          .map(([categoryKey, { category, templates }]) => (
            <div key={categoryKey} className="flex flex-col gap-1">
              <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
                {category.key}
              </h4>
              <div className="flex w-full items-center gap-1.5">
                {categoryChange.includes(category.key) && (
                  <IntegrationsCombobox
                    integrations={templates}
                    selectedIntegration={
                      selectedIntegrations[categoryKey] || null
                    }
                    onSelectIntegration={(integration) =>
                      handleSelectIntegration(categoryKey, integration)
                    }
                    categoryName={category.key}
                  />
                )}
                {selectedIntegrations[categoryKey] &&
                  !categoryChange.includes(category.key) &&
                  (() => {
                    return (
                      <ConfigurationDialog
                        integrationTemplate={
                          selectedIntegrations[
                            categoryKey
                          ] as RouterOutputs["integrationTemplates"]["list"][0]
                        }
                        environmentVariables={environmentVariables}
                        isConfigured={isConfigured(categoryKey)}
                        disabled={!needsUserConfig(categoryKey)}
                        onConfirm={() => {
                          const integration = selectedIntegrations[categoryKey];
                          if (integration) {
                            handleConfigurationConfirm(integration.id);
                          }
                        }}
                        onCancel={() => {
                          const integration = selectedIntegrations[categoryKey];
                          if (integration) {
                            handleConfigurationCancel(integration.id);
                          }
                        }}
                        onEnvironmentVariableMapping={(
                          configKey: string,
                          envVarId: string,
                        ) => {
                          const integration = selectedIntegrations[categoryKey];
                          if (integration) {
                            handleEnvironmentVariableMapping(
                              integration.id,
                              configKey,
                              envVarId,
                            );
                          }
                        }}
                        environmentVariableMappings={
                          configuredIntegrations[
                            selectedIntegrations[categoryKey]?.id || ""
                          ]?.environmentVariableMappings || {}
                        }
                      />
                    );
                  })()}
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-8"
                  onClick={() =>
                    setCategoryChange(
                      categoryChange.includes(category.key)
                        ? categoryChange.filter((c) => c !== category.key)
                        : [...categoryChange, category.key],
                    )
                  }
                >
                  {categoryChange.includes(category.key) ? (
                    <CheckIcon className="size-3.5 text-primary" />
                  ) : (
                    <PenIcon className="size-3.5" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        <div className="flex justify-end gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleIntegrationCancel}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleFinalConfirm}
            disabled={
              Object.values(selectedIntegrations).some(
                (integration) =>
                  integration && !isConfigured(integration.category.key),
              ) ||
              Object.values(selectedIntegrations).every(
                (integration) => !integration,
              ) ||
              categoryChange.length !== 0
            }
          >
            {createBatchIntegrationsMutation.isPending && (
              <LoaderIcon className="size-3 animate-spin" />
            )}
            Confirm
          </Button>
        </div>
      </div>
    </div>
  );
};

export const SetupIntegration = memo(
  PureSetupIntegration,
  (prevProps, nextProps) => {
    if (!fastDeepEqual(prevProps.message, nextProps.message)) {
      return false;
    }
    if (
      !fastDeepEqual(
        prevProps.environmentVariables,
        nextProps.environmentVariables,
      )
    ) {
      return false;
    }
    return true;
  },
);
