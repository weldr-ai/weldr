import type { JSONSchema7 } from "json-schema";
import type { z } from "zod";
import type {
  assistantMessageRawContentSchema,
  attachmentSchema,
  chatMessageSchema,
  chatSchema,
  messageRawContentSchema,
  testExecutionMessageRawContentSchema,
  userMessageRawContentSchema,
} from "../validators/chats";
import type {
  packageSchema,
  rawContentSchema,
  resourceMetadataSchema,
} from "../validators/common";
import type { endpointRequirementsMessageSchema } from "../validators/endpoints";
import type { environmentVariableSchema } from "../validators/environment-variables";
import type { funcRequirementsMessageSchema } from "../validators/funcs";
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
export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type Chat = z.infer<typeof chatSchema>;
export type Attachment = z.infer<typeof attachmentSchema>;

export type Resource = z.infer<typeof resourceSchema>;
export type ResourceMetadata = z.infer<typeof resourceMetadataSchema>;
export type OpenApiEndpointSpec = z.infer<typeof openApiEndpointSpecSchema>;

export type Integration = z.infer<typeof integrationSchema>;
export type IntegrationType = z.infer<typeof integrationTypeSchema>;
export type IntegrationHelperFunction = z.infer<
  typeof integrationHelperFunctionSchema
>;

export type EnvironmentVariable = z.infer<typeof environmentVariableSchema>;

export type RawContent = z.infer<typeof rawContentSchema>;
export type Package = z.infer<typeof packageSchema>;

export type FuncRequirementsMessage = z.infer<
  typeof funcRequirementsMessageSchema
>;
export type EndpointRequirementsMessage = z.infer<
  typeof endpointRequirementsMessageSchema
>;

export type TestExecutionMessageRawContent = z.infer<
  typeof testExecutionMessageRawContentSchema
>;
