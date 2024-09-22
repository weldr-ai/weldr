import { createOpenAI } from "@ai-sdk/openai";
import { type CoreMessage, streamText } from "ai";
import { type StreamableValue, createStreamableValue } from "ai/rsc";

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  compatibility: "strict",
});

export async function requirementsGatheringAgent({
  system,
  messages,
}: {
  system: string;
  messages: CoreMessage[];
}): Promise<StreamableValue> {
  const result = await streamText({
    model: openai("gpt-4o-mini"),
    system,
    messages,
    onFinish: ({ usage }) => {
      console.log(
        `[usage]: ${usage.promptTokens} prompt, ${usage.completionTokens} completion, ${usage.totalTokens} total`,
      );
    },
  });

  const stream = createStreamableValue(result.textStream);
  return stream.value;
}
