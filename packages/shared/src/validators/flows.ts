import { z } from "zod";
import { inputSchema, outputSchema } from "./common";
import { conversationSchema } from "./conversations";

export const flowTypesSchema = z.enum(["workflow", "endpoint", "utility"]);

export const endpointFlowMetadataSchema = z.object({
  method: z.enum(["get", "post", "patch", "delete"]),
  path: z.string().min(1, {
    message: "Path is required.",
  }),
  openApiSchema: z.record(z.string(), z.any()).optional(),
});

export const workflowFlowMetadataSchema = z.object({
  recurrence: z.enum(["hourly", "daily", "weekly", "monthly"]),
});

export const utilityFlowMetadataSchema = z.object({});

const baseFlowSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional().nullable(),
  type: flowTypesSchema,
  inputSchema: inputSchema.nullable().optional(),
  outputSchema: outputSchema.nullable().optional(),
  code: z.string().nullable().optional(),
  isUpdated: z.boolean().optional(),
  canRun: z.boolean().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  userId: z.string().nullable(),
  workspaceId: z.string(),
  inputConversationId: z.string(),
  inputConversation: conversationSchema,
  outputConversationId: z.string(),
  outputConversation: conversationSchema,
});

export const utilityFlowSchema = baseFlowSchema.extend({
  type: z.literal("utility"),
  metadata: utilityFlowMetadataSchema,
});

export const endpointFlowSchema = baseFlowSchema.extend({
  type: z.literal("endpoint"),
  metadata: endpointFlowMetadataSchema,
});

export const workflowFlowSchema = baseFlowSchema.extend({
  type: z.literal("workflow"),
  metadata: workflowFlowMetadataSchema,
});

export const flowSchema = z.discriminatedUnion("type", [
  utilityFlowSchema,
  endpointFlowSchema,
  workflowFlowSchema,
]);

export const baseInsertFlowSchema = z.object({
  name: z.string().min(1, {
    message: "Name is required.",
  }),
  type: flowTypesSchema,
  workspaceId: z.string().min(1, {
    message: "Workspace is required.",
  }),
});

export const insertUtilityFlowSchema = baseInsertFlowSchema.extend({
  type: z.literal("utility"),
});

export const insertEndpointFlowSchema = baseInsertFlowSchema.extend({
  type: z.literal("endpoint"),
  metadata: z.object({
    method: z.enum(["get", "post", "patch", "delete"]),
    path: z
      .string()
      .regex(
        /^\/(?:[a-z0-9][a-z0-9-]*|\{[a-z][a-zA-Z0-9]*\})(?:\/(?:[a-z0-9][a-z0-9-]*|\{[a-z][a-zA-Z0-9]*\}))*$/,
        {
          message:
            "Path must start with '/' followed by segments that are either lowercase alphanumeric with hyphens or variables in curly braces starting with lowercase (e.g. {userId}).",
        },
      ),
  }),
});

export const insertWorkflowFlowSchema = baseInsertFlowSchema.extend({
  type: z.literal("workflow"),
  metadata: z.object({
    recurrence: z.enum(["hourly", "daily", "weekly", "monthly"]),
  }),
});

export const insertFlowSchema = z.discriminatedUnion("type", [
  insertUtilityFlowSchema,
  insertEndpointFlowSchema,
  insertWorkflowFlowSchema,
]);

export const baseUpdateFlowSchema = z.object({
  name: z
    .string()
    .min(1, {
      message: "Name is required.",
    })
    .optional(),
  description: z.string().optional(),
  inputSchema: inputSchema.optional(),
  validationSchema: z.string().optional(),
  outputSchema: outputSchema.optional(),
  code: z.string().optional(),
});

export const updateEndpointFlowSchema = baseUpdateFlowSchema.extend({
  type: z.literal("endpoint"),
  metadata: z
    .object({
      method: z.enum(["get", "post", "patch", "delete"]).optional(),
      path: z
        .string()
        .regex(
          /^\/(?:[a-z0-9][a-z0-9-]*|\{[a-z][a-zA-Z0-9]*\})(?:\/(?:[a-z0-9][a-z0-9-]*|\{[a-z][a-zA-Z0-9]*\}))*$/,
          {
            message:
              "Path must start with '/' followed by segments that are either lowercase alphanumeric with hyphens or variables in curly braces starting with lowercase (e.g. {userId}).",
          },
        )
        .optional(),
    })
    .optional(),
});

export const updateWorkflowFlowSchema = baseUpdateFlowSchema.extend({
  type: z.literal("workflow"),
  metadata: z
    .object({
      recurrence: z.enum(["hourly", "daily", "weekly", "monthly"]).optional(),
    })
    .optional(),
});

export const updateUtilityFlowSchema = baseUpdateFlowSchema.extend({
  type: z.literal("utility"),
  metadata: z.object({}).optional(),
});

export const updateFlowSchema = z.object({
  where: z.object({
    id: z.string(),
  }),
  payload: z.discriminatedUnion("type", [
    updateUtilityFlowSchema,
    updateEndpointFlowSchema,
    updateWorkflowFlowSchema,
  ]),
});
