import { z } from "zod";

import { versionSchema } from "./versions";

export const branchSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  type: z.enum(["variant", "stream"]),
  parentBranchId: z.string().nullable(),
  forkedFromVersionId: z.string().nullable(),
  forksetId: z.string().nullable(),
  headVersionId: z.string().nullable(),
  isMain: z.boolean(),
  status: z.enum(["active", "archived"]),
  createdAt: z.date(),
  updatedAt: z.date().nullable(),
  headVersion: versionSchema,
});
