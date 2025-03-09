import { declarationMetadataSchema } from "@weldr/shared/validators/declarations/index";
import { streamObject } from "ai";
import { models } from "../models";

export async function annotator(code: string) {
  const { object } = streamObject({
    model: models.claudeSonnet,
    schema: declarationMetadataSchema
      .describe(
        "The list of metadata of the exported declarations. Create the metadata for the exported declarations only. It will be used to generate the documentation. MUST be a valid JSON object not a string.",
      )
      .array(),
    system: "Please, create metadata for the provided code.",
    prompt: `# Code\n${code}`,
    maxTokens: 8192,
  });

  return object;
}
