import { z } from "zod";

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
    .transform((name) => name.replace(/\s+/g, " ").trim()),
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
    path: z.string().transform((path) => {
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
    .transform((name) => name.replace(/\s+/g, " ").trim())
    .optional(),
  description: z.string().optional(),
  method: z.enum(["get", "post", "patch", "delete"]).optional(),
  path: z.string().optional(),
  inputs: z
    .object({
      id: z.string(),
      name: z.string(),
      testValue: z
        .union([z.string(), z.number()])
        .nullable()
        .optional()
        .default(null),
      type: z.enum(["number", "text", "functionResponse"]),
    })
    .array()
    .optional(),
});
