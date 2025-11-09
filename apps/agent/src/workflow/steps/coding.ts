import { coderAgent } from "@/ai/agents/coder";
import { stream } from "@/lib/stream-utils";
import { createStep } from "../engine";

export const codingStep = createStep({
  id: "coding",
  execute: async ({ context }) => {
    const branch = context.get("branch");

    await stream(branch.headVersion.chatId, {
      type: "status",
      status: "coding",
    });

    await coderAgent({ context });
  },
});
