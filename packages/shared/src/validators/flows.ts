import { z } from "zod";
import { inputSchema, outputSchema } from "./common";
import { conversationSchema } from "./conversations";

export const flowTypesSchema = z.enum(["workflow", "endpoint", "utility"]);

export const endpointFlowMetadataSchema = z.object({
  method: z.enum(["get", "post", "patch", "delete"]),
  path: z.string().regex(/^\/[a-z-]+(\/[a-z-]+)*$/, {
    message:
      "Must start with '/' and contain only lowercase letters and hyphens.",
  }),
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
  name: z
    .string()
    .min(1, {
      message: "Name is required.",
    })
    .regex(/^[a-z]/, {
      message: "Must start with a lowercase letter",
    })
    .regex(/^[a-z][a-z0-9-]*$/, {
      message: "Can only contain lowercase letters, numbers and hyphens",
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
    path: z
      .string()
      .regex(/^\//, {
        message: "Must start with '/'",
      })
      .regex(/^\/[a-z0-9]/, {
        message: "First segment must start with a letter or number",
      })
      .regex(/^\/[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)*$/, {
        message:
          "Path segments must contain only lowercase letters, numbers and hyphens",
      })
      .transform((path) => {
        if (path.startsWith("/")) return path.trim();
        return `/${path.trim()}`;
      }),
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
    .regex(/^[a-z]/, {
      message: "Must start with a lowercase letter",
    })
    .regex(/^[a-z][a-z0-9-]*$/, {
      message: "Can only contain lowercase letters, numbers and hyphens",
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
        .regex(/^\/[a-z-]+(\/[a-z-]+)*$/, {
          message:
            "Must start with '/' and contain only lowercase letters and hyphens.",
        })
        .transform((path) => {
          if (path.startsWith("/")) return path.trim();
          return `/${path.trim()}`;
        })
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
