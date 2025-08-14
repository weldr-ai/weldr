import type { ToolResultPart } from "ai";

import type { RouterOutputs } from "@weldr/api";
import type {
  ChatMessage,
  IntegrationCategoryKey,
  IntegrationKey,
  IntegrationStatus,
} from "@weldr/shared/types";

export type IntegrationTemplate =
  RouterOutputs["integrationTemplates"]["list"][0];
export type EnvironmentVariable =
  RouterOutputs["environmentVariables"]["list"][0];

export interface IntegrationConfiguration {
  templateId: string;
  name?: string;
  environmentVariableMappings: {
    envVarId: string;
    configKey: string;
  }[];
}

export interface SelectedIntegration {
  template: IntegrationTemplate;
  name?: string;
  environmentVariableMappings: Record<string, string>;
}

export type IntegrationToolOutput = {
  type: "json";
  value: {
    status:
      | "awaiting_config"
      | "installing"
      | "completed"
      | "cancelled"
      | "failed";
    categories: IntegrationCategoryKey[];
    integrations?: {
      category: IntegrationCategoryKey;
      key: IntegrationKey;
      name: string;
      status: IntegrationStatus;
    }[];
  };
};

export type IntegrationToolResultPart = ToolResultPart & {
  output: IntegrationToolOutput;
};

export type IntegrationToolMessage = ChatMessage & {
  id: string;
  role: "tool";
  content: Array<IntegrationToolResultPart>;
};
