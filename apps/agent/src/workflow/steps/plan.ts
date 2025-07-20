import { plannerAgent } from "@/ai/agents/planner";

import { createStep } from "../engine";

export const planStep = createStep({
  id: "plan",
  execute: async ({ context }) => {
    await plannerAgent({ context });
  },
});
