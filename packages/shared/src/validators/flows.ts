import { z } from "zod";
import { inputSchema, outputSchema } from "./common";
import { conversationSchema } from "./conversations";
import { stopPrimitiveSchema } from "./primitives";

export const flowTypesSchema = z.enum(["task", "endpoint", "utilities"]);

export const endpointFlowMetadataSchema = z.object({
  method: z.enum(["get", "post", "patch", "delete"]),
  path: z.string().regex(/^\/[a-z-]+(\/[a-z-]+)*$/, {
    message:
      "Must start with '/' and contain only lowercase letters and hyphens.",
  }),
});

export const taskFlowMetadataSchema = z.object({
  triggerType: z.enum(["webhook", "schedule"]),
});

export const utilitiesFlowMetadataSchema = z.object({});

const baseFlowSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional().nullable(),
  type: flowTypesSchema,
  inputSchema: inputSchema.nullable().optional(),
  validationSchema: z.string().nullable().optional(),
  outputSchema: outputSchema.nullable().optional(),
  code: z.string().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string().nullable(),
  workspaceId: z.string(),
  inputConversation: conversationSchema,
  outputConversation: conversationSchema,
  stopNode: stopPrimitiveSchema,
  inputConversationId: z.string(),
  outputConversationId: z.string(),
});

export const componentFlowSchema = baseFlowSchema.extend({
  type: z.literal("utilities"),
  metadata: utilitiesFlowMetadataSchema,
});

export const endpointFlowSchema = baseFlowSchema.extend({
  type: z.literal("endpoint"),
  metadata: endpointFlowMetadataSchema,
});

export const taskFlowSchema = baseFlowSchema.extend({
  type: z.literal("task"),
  metadata: taskFlowMetadataSchema,
});

export const flowSchema = z.discriminatedUnion("type", [
  componentFlowSchema,
  endpointFlowSchema,
  taskFlowSchema,
]);

export const baseInsertFlowSchema = z.object({
  name: z
    .string()
    .min(1, {
      message: "Name is required.",
    })
    .regex(/^\S*$/, {
      message: "Cannot contain spaces.",
    })
    .transform((name) => name.trim()),
  description: z.string().trim().optional(),
  type: flowTypesSchema,
  workspaceId: z.string().min(1, {
    message: "Workspace is required.",
  }),
});

export const insertUtilitiesFlowSchema = baseInsertFlowSchema.extend({
  type: z.literal("utilities"),
});

export const insertEndpointFlowSchema = baseInsertFlowSchema.extend({
  type: z.literal("endpoint"),
  metadata: z.object({
    method: z.enum(["get", "post", "patch", "delete"]),
    path: z
      .string()
      .regex(/^\/[a-z-]+(\/[a-z-]+)*$/, {
        message:
          "Must start with '/' and contain only lowercase letters and hyphens.",
      })
      .transform((path) => {
        if (path.startsWith("/")) return path.trim();
        return `/${path.trim()}`;
      }),
  }),
});

export const insertTaskFlowSchema = baseInsertFlowSchema.extend({
  type: z.literal("task"),
  metadata: z.object({
    triggerType: z.enum(["webhook", "schedule"]),
  }),
});

export const insertFlowSchema = z.discriminatedUnion("type", [
  insertUtilitiesFlowSchema,
  insertEndpointFlowSchema,
  insertTaskFlowSchema,
]);

export const baseUpdateFlowSchema = z.object({
  name: z
    .string()
    .min(1, {
      message: "Name is required.",
    })
    .regex(/^\S*$/, {
      message: "Cannot contain spaces.",
    })
    .transform((name) => name.trim())
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

export const updateTaskFlowSchema = baseUpdateFlowSchema.extend({
  type: z.literal("task"),
  metadata: z
    .object({
      triggerType: z.enum(["webhook", "schedule"]).optional(),
    })
    .optional(),
});

export const updateUtilitiesFlow = baseUpdateFlowSchema.extend({
  type: z.literal("utilities"),
  metadata: z.object({}).optional(),
});

export const updateFlowSchema = z.object({
  where: z.object({
    id: z.string(),
  }),
  payload: z.discriminatedUnion("type", [
    updateUtilitiesFlow,
    updateEndpointFlowSchema,
    updateTaskFlowSchema,
  ]),
});
