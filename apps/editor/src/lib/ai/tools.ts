import { tool } from "ai";
import { z } from "zod";

export const initializeProject = tool({
  description: "Initialize a new project",
  parameters: z.object({
    name: z.string().min(1).describe("The name of the project"),
    addons: z
      .enum(["auth"])
      .array()
      .describe("A list of addons to use for the project"),
    requirements: z
      .string()
      .min(1)
      .describe(
        `A description of the app and its features.
        Example:
        A simple client-side todo app with the ability to add tasks, display them, and mark them as done.
        Doesn't require backend. Doesn't require authentication. Doesn't require database.`,
      ),
  }),
});

export const setupResource = tool({
  description: "Setup the resources for the project",
  parameters: z.object({
    resource: z.enum(["postgres"]).describe("The type of resource to setup"),
  }),
  execute: async () => {
    return {
      status: "pending",
    };
  },
});

export const implement = tool({
  description: "Implement the user's request",
  parameters: z.object({
    addons: z
      .enum(["auth"])
      .array()
      .describe("A list of addons to use for the implementation"),
    requirements: z
      .string()
      .min(1)
      .describe(
        `A concise and clear description of the changes the user wants to make to the app.
        - MUST NOT deviate from what the user wants exactly.`,
      ),
  }),
});
