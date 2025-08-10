import { coderAgent } from "@/ai/agents/coder";
import { createStep } from "../engine";

export const codeStep = createStep({
  id: "code",
  execute: async ({ context }) => {
    await coderAgent({ context });
  },
});
