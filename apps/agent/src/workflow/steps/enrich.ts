import { enrichAgent } from "@/ai/agents/enricher";
import { createStep } from "../engine";

export const enrichStep = createStep({
  id: "enrich",
  execute: async ({ context }) => {
    await enrichAgent({ context });
  },
});
