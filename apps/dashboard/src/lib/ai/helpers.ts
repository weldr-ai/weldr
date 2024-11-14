import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import "server-only";

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export function getTypescriptCode(content: string): string {
  return content.replace(/```typescript\n|```/g, "");
}

export async function generateCode({
  functionId,
  prompt,
  systemPrompt,
}: {
  functionId: string;
  prompt: string;
  systemPrompt: string;
}) {
  console.log(`[generateCode] Starting for function ${functionId}`);

  const { text, usage } = await generateText({
    model: anthropic("claude-3-5-sonnet-20240620"),
    system: systemPrompt,
    prompt,
  });

  console.log(
    `[generateCode] Completed with usage: ${usage.promptTokens} prompt, ${usage.completionTokens} completion, ${usage.totalTokens} total`,
  );

  return getTypescriptCode(text);
}
