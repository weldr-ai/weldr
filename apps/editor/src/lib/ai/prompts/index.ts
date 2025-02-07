import fs from "node:fs";

export function readPrompt(promptName: string) {
  return fs.readFileSync(`${__dirname}/prompts/${promptName}.txt`, "utf-8");
}

export const coderPrompt = readPrompt("coder");
