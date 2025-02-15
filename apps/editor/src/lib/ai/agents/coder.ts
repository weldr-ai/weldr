import "server-only";

import { type CoreMessage, type CoreUserMessage, streamText } from "ai";
import { createStreamableValue } from "ai/rsc";
import { models } from "../models";
import { prompts } from "../prompts";

export async function coder(prompt: CoreUserMessage) {
  const stream = createStreamableValue<string>();

  async function generate() {
    const currentMessages: CoreMessage[] = [prompt];

    let currentContent = "";

    const { textStream } = streamText({
      model: models.claudeSonnet,
      system: prompts.generalCoder,
      messages: currentMessages,
      onFinish({ finishReason, text }) {
        if (finishReason === "length") {
          currentMessages.push({
            role: "assistant",
            content: currentContent,
          });
          generate();
        }
      },
    });

    for await (const text of textStream) {
      currentContent += text;
      stream.update(text);
    }
  }

  generate();

  return stream.value;
}
