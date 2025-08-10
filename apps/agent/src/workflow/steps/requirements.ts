import { requirementsAgent } from "@/ai/agents/requirements";
import { createStep } from "../engine";

export const requirementsStep = createStep({
  id: "requirements",
  execute: async ({ context }) => {
    await requirementsAgent({ context });
  },
});
