import { z } from "zod";
import { conversationSchema, inputSchema } from "./common";

export const flowTypesSchema = z.enum(["component", "task", "endpoint"]);

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

export const componentFlowMetadataSchema = z.object({});

export const baseFlowSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().trim().optional(),
  type: flowTypesSchema,
  inputSchema: inputSchema.optional().nullable(),
  validationSchema: z.string().optional().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string(),
  workspaceId: z.string(),
  conversation: conversationSchema,
});

export const componentFlowSchema = baseFlowSchema.extend({
  type: z.literal("component"),
  metadata: componentFlowMetadataSchema,
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
    .regex(/^[a-z0-9_]+$/, {
      message:
        "Name must only contain lowercase letters, numbers, and underscores",
    })
    .regex(/^[a-z0-9].*[a-z0-9]$/, {
      message: "Name must not start or end with an underscore",
    })
    .regex(/^(?!.*__).*$/, {
      message: "Name must not contain consecutive underscores",
    })
    .transform((name) => name.replace(/\s+/g, "ـ").toLowerCase().trim()),
  description: z.string().trim().optional(),
  type: flowTypesSchema,
  workspaceId: z.string().min(1, {
    message: "Workspace is required.",
  }),
});

export const insertComponentFlowSchema = baseInsertFlowSchema.extend({
  type: z.literal("component"),
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
  insertComponentFlowSchema,
  insertEndpointFlowSchema,
  insertTaskFlowSchema,
]);

export const baseUpdateFlowSchema = z.object({
  name: z
    .string()
    .min(1, {
      message: "Name is required.",
    })
    .regex(/^[a-z0-9_]+$/, {
      message:
        "Name must only contain lowercase letters, numbers, and underscores",
    })
    .regex(/^[a-z0-9].*[a-z0-9]$/, {
      message: "Name must not start or end with an underscore",
    })
    .regex(/^(?!.*__).*$/, {
      message: "Name must not contain consecutive underscores",
    })
    .transform((name) => name.replace(/\s+/g, "ـ").toLowerCase().trim())
    .optional(),
  description: z.string().optional(),
  inputSchema: inputSchema.optional(),
  validationSchema: z.string().optional(),
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

export const updateComponentFlow = baseUpdateFlowSchema.extend({
  type: z.literal("component"),
  metadata: z.object({}).optional(),
});

export const updateFlowSchema = z.object({
  where: z.object({
    id: z.string(),
  }),
  payload: z.discriminatedUnion("type", [
    updateComponentFlow,
    updateEndpointFlowSchema,
    updateTaskFlowSchema,
  ]),
});
