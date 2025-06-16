import { Agent } from "@mastra/core/agent";
import { registry } from "../../lib/registry";
import { prompts } from "../prompts";

export const enricherAgent = new Agent({
  name: "Enricher",
  instructions: prompts.enricher,
  model: registry.languageModel("openai:gpt-4.1"),
});
