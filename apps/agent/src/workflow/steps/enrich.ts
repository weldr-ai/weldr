import { enrichAgent } from "@/ai/agents/enricher";
import type { WorkflowContext } from "@/workflow/context";
import { createStep } from "../engine";

export const enrichStep = createStep<WorkflowContext>({
  id: "enrich",
  execute: async ({ context }) => {
    await enrichAgent({ context });
  },
});
