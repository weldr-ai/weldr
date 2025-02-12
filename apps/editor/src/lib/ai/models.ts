import { createAnthropic } from "@ai-sdk/anthropic";
import { createFireworks } from "@ai-sdk/fireworks";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
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

export const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export const models = {
  // OpenAI
  gpt4o: openai("gpt-4o"),
  gpt4oMini: openai("gpt-4o-mini"),

  // Anthropic
  claudeSonnet: anthropic("claude-3-5-sonnet-latest"),

  // Fireworks
  deepseekR1: fireworks("accounts/fireworks/models/deepseek-r1"),

  // Google
  geminiFlash: google("gemini-2.0-flash-001"),
  geminiFlashThinkingExp: google("gemini-2.0-flash-thinking-exp-01-21"),
  geminiPro: google("gemini-2.0-pro-exp-02-05"),
} as const;
