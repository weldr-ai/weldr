import type { z } from "zod";
import type {
  dataTypeSchema,
  funcRequirementsMessageSchema,
  npmDependencySchema,
  rawContentSchema,
} from "../validators/common";
import type {
  assistantMessageRawContentSchema,
  conversationMessageSchema,
  conversationSchema,
  messageRawContentSchema,
  userMessageRawContentSchema,
} from "../validators/conversations";
import type { endpointSchema } from "../validators/endpoints";
import type { environmentVariableSchema } from "../validators/environment-variables";
import type { funcResourceSchema, funcSchema } from "../validators/funcs";
import type {
  integrationHelperFunctionSchema,
  integrationSchema,
  integrationTypeSchema,
} from "../validators/integrations";
import type { moduleSchema } from "../validators/modules";
import type { projectSchema } from "../validators/projects";
import type { resourceSchema } from "../validators/resources";
import type { testRunSchema } from "../validators/test-runs";

export type DataType = z.infer<typeof dataTypeSchema>;

export interface JsonSchema {
  // Basic schema properties
  type?:
    | "string"
    | "number"
    | "integer"
    | "boolean"
    | "object"
    | "array"
    | "null";
  title?: string;
  description?: string;

  // For objects
  required?: string[];
  properties?: Record<string, JsonSchema>;
  additionalProperties?: boolean | JsonSchema;

  // For arrays
  items?: JsonSchema | JsonSchema[];
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;

  // String validations
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;

  // Number validations
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  multipleOf?: number;

  // Combiners
  oneOf?: JsonSchema[];
  anyOf?: JsonSchema[];
  allOf?: JsonSchema[];
  not?: JsonSchema;

  // Conditionals
  if?: JsonSchema;
  then?: JsonSchema;
  else?: JsonSchema;

  // Enum
  enum?: (string | number | boolean | null)[];

  // Schema metadata
  $id?: string;
  $schema?: string;
  $ref?: string;
  definitions?: Record<string, JsonSchema>;

  // Misc
  default?: unknown;
  examples?: unknown[];
}

export interface FlatInputSchema {
  path: string;
  type: DataType;
  required: boolean;
  description?: string;
  refUri: string;
  properties?: Record<string, JsonSchema>;
  itemsType?: JsonSchema;
  sourceFuncId?: string;
}

export type Project = z.infer<typeof projectSchema>;

export type Module = z.infer<typeof moduleSchema>;

export type UserMessageRawContent = z.infer<typeof userMessageRawContentSchema>;
export type AssistantMessageRawContent = z.infer<
  typeof assistantMessageRawContentSchema
>;
export type MessageRawContent = z.infer<typeof messageRawContentSchema>;
export type ConversationMessage = z.infer<typeof conversationMessageSchema>;
export type Conversation = z.infer<typeof conversationSchema>;

export type Resource = z.infer<typeof resourceSchema>;
export type FuncResource = z.infer<typeof funcResourceSchema>;
export type Endpoint = z.infer<typeof endpointSchema>;

export type Integration = z.infer<typeof integrationSchema>;
export type IntegrationType = z.infer<typeof integrationTypeSchema>;
export type IntegrationHelperFunction = z.infer<
  typeof integrationHelperFunctionSchema
>;

export type EnvironmentVariable = z.infer<typeof environmentVariableSchema>;

export type RawContent = z.infer<typeof rawContentSchema>;
export type NpmDependency = z.infer<typeof npmDependencySchema>;
export type Func = z.infer<typeof funcSchema>;
export type TestRun = z.infer<typeof testRunSchema>;

export type FuncRequirementsMessage = z.infer<
  typeof funcRequirementsMessageSchema
>;

export type BaseFormState<
  FormFields = Record<string, string>,
  TPayload = unknown,
> =
  | {
      status: "success";
      title?: string;
      payload: TPayload;
      message?: string;
    }
  | {
      status: "validationError";
      title?: string;
      fields: FormFields;
      errors: FormFields;
    }
  | {
      status: "error";
      title?: string;
      fields: FormFields;
      message?: string;
    }
  | undefined;
