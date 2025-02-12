import { tool } from "ai";
import { z } from "zod";

export const initializeProject = tool({
  description: "Initialize a new project",
  parameters: z.object({
    name: z.string().min(1).describe("The name of the project"),
    description: z
      .string()
      .min(1)
      .describe("A short description of the project"),
    addons: z
      .enum(["auth"])
      .array()
      .describe("A list of addons to use for the project"),
    detailedDescription: z
      .string()
      .min(1)
      .describe(
        `A refined detailed description of what the user wants to do.
        This description will be used by the coder, so it should be as detailed and specific as possible.
        The description MUST NOT include information about technical implementation details.`,
      ),
  }),
});

export const setupResource = tool({
  description: "Setup the resources for the project",
  parameters: z.object({
    resource: z.enum(["postgres"]).describe("The type of resource to setup"),
  }),
});

export const implement = tool({
  description: "Implement the user's request",
  parameters: z.object({
    addons: z
      .enum(["auth"])
      .array()
      .describe("A list of addons to use for the implementation"),
    detailedDescription: z
      .string()
      .min(1)
      .describe(
        `A refined detailed description of what the user wants to do.
        Like adding a new feature, fixing a bug, editing something, etc.
        This description will be used by the coder, so it should be as detailed and specific as possible.
        The description MUST NOT include information about technical implementation details.`,
      ),
  }),
});
