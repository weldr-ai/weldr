import { z } from "zod";
import { defineTool } from "../utils/tools";

export const doneTool = defineTool({
  name: "done",
  description: "Mark the task as done",
  whenToUse: "always after finishing coding",
  example: "<done />",
  inputSchema: z.object({}),
  execute: async () => {
    return {
      success: true,
      message: "Task marked as done",
    };
  },
});
