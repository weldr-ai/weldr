import OpenAI from "openai";

import { extractCode } from "./utils";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateCode(
  systemMessage: string,
  userMessage: string,
): Promise<string> {
  const completion = await openai.chat.completions.create({
    messages: [
      {
        role: "system",
        content: systemMessage,
      },
      {
        role: "user",
        content: userMessage,
      },
    ],
    model: "gpt-4o",
  });

  const functionCode = extractCode(
    (
      completion.choices[0] as {
        message: { content: string };
      }
    ).message.content,
    "typescript",
  );

  if (!functionCode) {
    throw new Error("Failed to extract code");
  }

  return functionCode;
}
