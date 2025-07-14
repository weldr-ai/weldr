import { OpenAI } from "openai";

const morphClient = new OpenAI({
  apiKey: process.env.MORPH_API_KEY,
  baseURL: "https://api.morphllm.com/v1",
});

export async function applyEdit(
  originalCode: string,
  editInstructions: string,
): Promise<string> {
  const response = await morphClient.chat.completions.create({
    model: "auto",
    messages: [
      {
        role: "user",
        content: `<code>${originalCode}</code>\n<update>${editInstructions}</update>`,
      },
    ],
    stream: true,
  });

  let updatedCode = "";

  for await (const chunk of response) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      updatedCode += content;
    }
  }

  if (!updatedCode) {
    throw new Error("Failed to get updated code from the edit operation.");
  }

  return updatedCode;
}
