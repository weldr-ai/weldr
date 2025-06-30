import { z } from "zod";
import { createTool } from "../utils/tools";

export const doneTool = createTool({
  name: "done",
  description: "Mark the task as done.",
  whenToUse:
    "When you have completed all the requested tasks and want to signal completion.",
  inputSchema: z.object({}),
  outputSchema: z.object({}),
  execute: async () => ({
    success: true,
    message: "Task marked as done",
  }),
});
