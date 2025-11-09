import { generateObject, type ModelMessage } from "ai";
import { z } from "zod";

import { Logger } from "@weldr/shared/logger";

import { registry } from "./registry";

const versionDetailsSchema = z.object({
  message: z.string().describe(`
    Commit message following conventional commit format.
    Should be a single sentence that captures the essence of the changes.
    Examples:
    - feat: add user profile page
    - fix: update user profile page
    - chore: update dependencies
    - refactor: update user profile page
    - test: add user profile page tests
  `),
  description: z.string().describe(`
    Comprehensive description of the version, including:
    - Business requirements and objectives
    - User stories and use cases
    - Overall scope and boundaries
    - Integration requirements

    Should start with present tense verbs (e.g., "Creates", "Builds", "Implements") rather than "This version".
    Example: "Creates a simple, single-page web application where users can manage a to-do list..."

    This should provide the big picture context for all changes.
  `),
});

export async function generateVersionDetails(messages: ModelMessage[]) {
  const { object } = await generateObject({
    system: `You are a helpful assistant that generates concise, professional commit messages and comprehensive descriptions.

    Guidelines:
    - Commit messages should follow conventional commit format (feat:, fix:, chore:, refactor:, test:)
    - Commit messages should be imperative mood (e.g., "Add feature" not "Added feature")
    - Descriptions should start with present tense verbs (e.g., "Creates", "Builds", "Implements")
    - Descriptions should be comprehensive and provide context
    - Both should accurately reflect the conversation and changes discussed
    `,
    model: registry.languageModel("google:gemini-2.5-flash"),
    prompt: `Based on the conversation history, generate a commit message and description that summarize the changes.`,
    messages,
    schema: versionDetailsSchema,
    maxOutputTokens: 1024,
  });

  Logger.info("Generated version details", {
    message: object.message,
    description: object.description,
  });

  return object;
}
