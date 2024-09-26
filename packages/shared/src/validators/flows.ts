import { z } from "zod";
import { inputSchema } from "./primitives";

export const flowTypesSchema = z.enum(["component", "workflow", "route"]);

export const flowSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().trim().optional(),
  type: flowTypesSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string(),
  workspaceId: z.string(),
});

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

export const insertRouteFlowSchema = baseInsertFlowSchema.extend({
  type: z.literal("route"),
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

export const insertWorkflowFlowSchema = baseInsertFlowSchema.extend({
  type: z.literal("workflow"),
  metadata: z.object({
    triggerType: z.enum(["webhook", "schedule"]),
  }),
});

export const insertFlowSchema = z.discriminatedUnion("type", [
  insertComponentFlowSchema,
  insertRouteFlowSchema,
  insertWorkflowFlowSchema,
]);

export const updateRouteFlowSchema = z.object({
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
  inputs: inputSchema.array().optional(),
});
