import { plannerAgent } from "@/ai/agents/planner";

import { createStep } from "../engine";

export const planStep = createStep({
  id: "plan",
  execute: async ({ context }): Promise<"suspend" | undefined> => {
    return await plannerAgent({ context });
  },
});
