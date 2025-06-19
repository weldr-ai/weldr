import { coderAgent } from "@/ai/agents/coder";
import type { WorkflowContext } from "@/workflow/context";
import { createStep } from "../engine";

export const codeStep = createStep<WorkflowContext>({
  id: "code",
  execute: async ({ context }) => {
    await coderAgent({ context });
  },
});
