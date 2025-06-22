import { z } from "zod";
import { createTool } from "../utils/create-tool";

export const doneTool = createTool({
  description: "Mark the task as done",
  inputSchema: z.object({}),
  outputSchema: z.object({}),
  execute: async () => ({
    success: true,
    message: "Task marked as done",
  }),
});
