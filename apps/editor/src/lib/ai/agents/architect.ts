import "server-only";

import { type CoreMessage, type CoreUserMessage, streamText } from "ai";
import { models } from "../models";
import { prompts } from "../prompts";

export async function architect(prompt: CoreUserMessage, context: string) {
  const messages: CoreMessage[] = [prompt];

  let coderPrompt = "";

  const { textStream } = streamText({
    model: models.deepseekR1,
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
