import { z } from "zod";

export const httpMethods = z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]);

export const endpointPathSchema = z
  .string()
  .regex(
    /^\/(?:[a-z0-9][a-z0-9-]*|\{[a-z][a-zA-Z0-9]*\})(?:\/(?:[a-z0-9][a-z0-9-]*|\{[a-z][a-zA-Z0-9]*\}))*$/,
    {
      message:
        "Path must start with '/' followed by segments that are either lowercase alphanumeric with hyphens or variables in curly braces starting with lowercase (e.g. {userId}).",
    },
  );

export const endpointSchema = z.object({
  id: z.string().cuid2(),
  name: z.string().min(1),
  description: z.string().optional(),
  httpMethod: httpMethods,
  path: endpointPathSchema,
  routeHandler: z.string().optional(),
  openApiSpec: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  workspaceId: z.string().cuid2(),
});

export const insertEndpointSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  httpMethod: httpMethods,
  path: endpointPathSchema,
  workspaceId: z.string().cuid2(),
});

export const updateEndpointSchema = z.object({
  where: z.object({
    id: z.string(),
  }),
  payload: insertEndpointSchema.extend({
    openApiSpec: z.record(z.string(), z.unknown()).optional(),
    routeHandler: z.string().optional(),
  }),
});
