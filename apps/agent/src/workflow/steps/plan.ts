import { plannerAgent } from "@/ai/agents/planner";
import type { WorkflowContext } from "@/workflow/context";
import { createStep } from "../engine";

export const planStep = createStep<WorkflowContext>({
  id: "plan",
  execute: async ({ context }) => {
    await plannerAgent({ context });
  },
});
