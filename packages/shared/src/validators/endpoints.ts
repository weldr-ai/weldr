import { z } from "zod";
import { conversationSchema } from "./conversations";
import { funcSchema } from "./funcs";

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
  name: z.string().min(1).trim(),
  description: z.string().optional(),
  httpMethod: httpMethodsSchema,
  path: endpointPathSchema,
  code: z.string().optional(),
  openApiSpec: z.record(z.string(), z.unknown()).optional(),
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
    name: z
      .string()
      .min(1, { message: "Name is required" })
      .regex(/^[^\s].*$/, {
        message: "Name can't start with whitespace",
      })
      .trim()
      .optional(),
    description: z.string().optional(),
    httpMethod: httpMethodsSchema.optional(),
    path: endpointPathSchema.optional(),
    code: z.string().optional(),
    openApiSpec: z.record(z.string(), z.unknown()).optional(),
    routeHandler: z.string().optional(),
    funcs: z.array(funcSchema).optional(),
    positionX: z.number().optional(),
    positionY: z.number().optional(),
  }),
});
