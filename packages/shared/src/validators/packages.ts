import { z } from "zod";

export const packageSchema = z.object({
  type: z.enum(["runtime", "development"]),
  name: z.string().describe("The name of the npm package"),
  version: z.string().optional().describe("The version of the npm package"),
  reason: z.string().describe("The reason for the npm package"),
});
