import { plannerAgent } from "@/ai/agents/planner";
import { stream } from "@/lib/stream-utils";
import { createStep } from "../engine";

export const planningStep = createStep({
  id: "planning",
  execute: async ({ context }) => {
    const branch = context.get("branch");

    await stream(branch.headVersion.chatId, {
      type: "status",
      status: "planning",
    });

    await plannerAgent({ context });
  },
});
