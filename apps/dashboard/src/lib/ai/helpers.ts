import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import "server-only";
import { FUNCTION_DEVELOPER_PROMPT } from "./prompts";

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export function getTypescriptCode(content: string): string {
  return content.replace(/```typescript\n|```/g, "");
}

export async function generateFunctionCode({
  functionId,
  prompt,
}: {
  functionId: string;
  prompt: string;
}) {
  console.log(`[generateFunctionCode] Starting for function ${functionId}`);

  const { text, usage } = await generateText({
    model: anthropic("claude-3-5-sonnet-20240620"),
    system: FUNCTION_DEVELOPER_PROMPT,
    prompt,
  });

  console.log(
    `[generateFunctionCode] Completed with usage: ${usage.promptTokens} prompt, ${usage.completionTokens} completion, ${usage.totalTokens} total`,
  );

  return getTypescriptCode(text);
}
