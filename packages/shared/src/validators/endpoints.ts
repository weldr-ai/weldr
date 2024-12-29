import { z } from "zod";
import { conversationSchema } from "./conversations";
import { funcSchema } from "./funcs";
import { openApiEndpointSpecSchema } from "./openapi";

export const httpMethodsSchema = z.enum([
  "get",
  "post",
  "put",
  "delete",
  "patch",
]);

export const endpointPathSchema = z
  .string()
  .min(1, {
    message: "Path is required",
  })
  .regex(
    /^\/(?:(?:[a-z0-9][a-z0-9-]*|\{[a-z][a-zA-Z0-9]*\})(?:\/(?:[a-z0-9][a-z0-9-]*|\{[a-z][a-zA-Z0-9]*\}))*)?$/,
    {
      message:
        "Path must start with '/' and can be followed by segments that are either lowercase alphanumeric with hyphens or variables in curly braces starting with lowercase (e.g. {userId}).",
    },
  );

export const endpointSchema = z.object({
  id: z.string().cuid2(),
  title: z.string().min(1).trim(),
  summary: z.string().optional(),
  description: z.string().optional(),
  method: httpMethodsSchema,
  path: endpointPathSchema,
  code: z.string().optional(),
  openApiSpec: openApiEndpointSpecSchema.optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  projectId: z.string().cuid2(),
  funcs: z.array(funcSchema),
  conversationId: z.string().cuid2(),
  conversation: conversationSchema,
});

export const insertEndpointSchema = z.object({
  id: z.string().cuid2(),
  positionX: z.number(),
  positionY: z.number(),
  projectId: z.string().cuid2(),
});

export const updateEndpointSchema = z.object({
  where: z.object({
    id: z.string(),
  }),
  payload: z.object({
    title: z
      .string()
      .min(1, { message: "Title is required" })
      .regex(/^[^\s].*$/, {
        message: "Title can't start with whitespace",
      })
      .trim()
      .optional(),
    summary: z.string().optional(),
    description: z.string().optional(),
    method: httpMethodsSchema.optional(),
    path: endpointPathSchema.optional(),
    code: z.string().optional(),
    openApiSpec: openApiEndpointSpecSchema.optional(),
    routeHandler: z.string().optional(),
    funcs: z.array(funcSchema).optional(),
    positionX: z.number().optional(),
    positionY: z.number().optional(),
  }),
});
