import type { JSONSchema7 } from "json-schema";
import type { z } from "zod";
import type {
  packageSchema,
  rawContentSchema,
  resourceMetadataSchema,
} from "../validators/common";
import type {
  assistantMessageRawContentSchema,
  conversationMessageSchema,
  conversationSchema,
  messageRawContentSchema,
  testExecutionMessageRawContentSchema,
  userMessageRawContentSchema,
} from "../validators/conversations";
import type {
  endpointRequirementsMessageSchema,
  endpointSchema,
} from "../validators/endpoints";
import type { environmentVariableSchema } from "../validators/environment-variables";
import type {
  funcRequirementsMessageSchema,
  funcSchema,
} from "../validators/funcs";
import type {
  integrationHelperFunctionSchema,
  integrationSchema,
  integrationTypeSchema,
} from "../validators/integrations";
import type { dataTypeSchema } from "../validators/json-schema";
import type { openApiEndpointSpecSchema } from "../validators/openapi";
import type { projectSchema } from "../validators/projects";
import type { resourceSchema } from "../validators/resources";

export type DataType = z.infer<typeof dataTypeSchema>;

export type JsonSchema = JSONSchema7;

export type Project = z.infer<typeof projectSchema>;

export type UserMessageRawContent = z.infer<typeof userMessageRawContentSchema>;
export type AssistantMessageRawContent = z.infer<
  typeof assistantMessageRawContentSchema
>;
export type MessageRawContent = z.infer<typeof messageRawContentSchema>;
export type ConversationMessage = z.infer<typeof conversationMessageSchema>;
export type Conversation = z.infer<typeof conversationSchema>;

export type Resource = z.infer<typeof resourceSchema>;
export type ResourceMetadata = z.infer<typeof resourceMetadataSchema>;
export type Endpoint = z.infer<typeof endpointSchema>;
export type OpenApiEndpointSpec = z.infer<typeof openApiEndpointSpecSchema>;

export type Integration = z.infer<typeof integrationSchema>;
export type IntegrationType = z.infer<typeof integrationTypeSchema>;
export type IntegrationHelperFunction = z.infer<
  typeof integrationHelperFunctionSchema
>;

export type EnvironmentVariable = z.infer<typeof environmentVariableSchema>;

export type RawContent = z.infer<typeof rawContentSchema>;
export type Package = z.infer<typeof packageSchema>;
export type Func = z.infer<typeof funcSchema>;

export type FuncRequirementsMessage = z.infer<
  typeof funcRequirementsMessageSchema
>;
export type EndpointRequirementsMessage = z.infer<
  typeof endpointRequirementsMessageSchema
>;

export type TestExecutionMessageRawContent = z.infer<
  typeof testExecutionMessageRawContentSchema
>;
