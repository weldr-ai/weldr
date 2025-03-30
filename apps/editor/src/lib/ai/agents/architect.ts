import "server-only";

import { type CoreMessage, type CoreUserMessage, streamText } from "ai";
import { prompts } from "../prompts";
import { registry } from "../registry";

export async function architect(prompt: CoreUserMessage, context: string) {
  const messages: CoreMessage[] = [prompt];

  let coderPrompt = "";

  const { textStream } = streamText({
    model: registry.languageModel(
      "fireworks:accounts/fireworks/models/deepseek-v3",
    ),
    system: prompts.architect(context),
    messages,
  });

  for await (const text of textStream) {
    coderPrompt += text;
  }

  console.log("--------------- ARCHITECT RESPONSE -----------------");
  console.log(coderPrompt);

  // const files = await coder({
  //   role: "user",
  //   content: coderPrompt,
  // });

  // return files;
}
