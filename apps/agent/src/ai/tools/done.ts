import { z } from "zod";

import { createTool } from "./utils";

export const doneTool = createTool({
  name: "done",
  description: "Mark the task as done.",
  whenToUse:
    "When you have completed all the requested tasks and want to signal completion.",
  inputSchema: z.object({}),
  outputSchema: z.void(),
});
