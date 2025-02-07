import { createAnthropic } from "@ai-sdk/anthropic";
import { createFireworks } from "@ai-sdk/fireworks";
import { createOpenAI } from "@ai-sdk/openai";

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const fireworks = createFireworks({
  apiKey: process.env.FIREWORKS_API_KEY,
});

export const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const claudeSonnet = anthropic("claude-3-5-sonnet-latest");

export const deepseekR1 = fireworks("accounts/fireworks/models/deepseek-r1");

export const gpt4oMini = openai("gpt-4o-mini");
