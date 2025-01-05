import { z } from "zod";

export const insertVersionSchema = z.object({
  versionName: z.string(),
  addedFuncIds: z.array(z.string()).optional(),
  addedEndpointIds: z.array(z.string()).optional(),
  deletedFuncIds: z.array(z.string()).optional(),
  deletedEndpointIds: z.array(z.string()).optional(),
  projectId: z.string(),
  messageId: z.string().optional(),
});
