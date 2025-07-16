import type {
  Integration,
  IntegrationKey,
  IntegrationTemplate,
} from "@weldr/shared/types";
import type { WorkflowContext } from "@/workflow/context";

export interface IntegrationCallbackResult {
  success: boolean;
  message?: string;
  installedPackages?: string[];
  createdFiles?: string[];
  errors?: string[];
}

export type FileItem =
  | {
      type: "copy" | "llm_instruction";
      sourcePath: string;
      targetPath: string;
      content: string;
    }
  | {
      type: "handlebars";
      sourcePath: string;
      targetPath: string;
      template: string;
      variables: Record<string, string>;
    };

export type IntegrationCallback = (
  context: WorkflowContext,
) => Promise<IntegrationCallbackResult>;

export type ExtractOptionsForKey<K extends IntegrationKey> = Extract<
  Integration,
  { key: K }
>["options"];

export type ExtractTemplateForKey<K extends IntegrationKey> = Extract<
  IntegrationTemplate,
  { key: K }
>;

interface IntegrationDefinitionExtension<K extends IntegrationKey> {
  packages?:
    | {
        add: {
          runtime?: Record<string, string>;
          development?: Record<string, string>;
        };
        remove?: string[];
      }
    | ((options?: ExtractOptionsForKey<K>) =>
        | {
            add: {
              runtime?: Record<string, string>;
              development?: Record<string, string>;
            };
            remove?: string[];
          }
        | undefined);
  dirMap: {
    "standalone-backend"?: Record<string, string>;
    "standalone-frontend"?: Record<string, string>;
    "full-stack"?: Record<string, string>;
  };
  scripts?:
    | Record<string, string>
    | ((
        options?: ExtractOptionsForKey<K>,
      ) => Promise<Record<string, string> | undefined>);
  preInstall?: IntegrationCallback;
  postInstall?: IntegrationCallback;
}

// biome-ignore lint/suspicious/noExplicitAny: required for distributive omit
export type DistributiveOmit<T, K extends keyof T> = T extends any
  ? Omit<T, K>
  : never;

export type IntegrationDefinition<K extends IntegrationKey> = DistributiveOmit<
  ExtractTemplateForKey<K>,
  "id" | "createdAt" | "updatedAt"
> &
  IntegrationDefinitionExtension<K>;
