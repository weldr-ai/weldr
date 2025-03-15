import { declarationMetadataSchema } from "@weldr/shared/validators/declarations/index";
import { streamObject } from "ai";
import { models } from "../models";

export async function annotator({
  code,
  newDeclarations,
  updatedDeclarations,
}: {
  code: string;
  newDeclarations: string[];
  updatedDeclarations: { name: string; metadata: unknown }[];
}) {
  const { object } = streamObject({
    model: models.claudeSonnet,
    schema: declarationMetadataSchema
      .describe(
        "The list of metadata of the exported declarations. Create the metadata for the provided declarations only. It will be used to generate the documentation. MUST be a valid JSON object not a string.",
      )
      .array(),
    system:
      "Please, create metadata for the provided declarations based on the code. You must create metadata for new declarations and update the metadata for updated declarations if needed. You must return a valid JSON object not a string.",
    prompt: `# Code\n${code}\n\n# New declarations\n${newDeclarations.join(
      "\n",
    )}${
      updatedDeclarations.length > 0
        ? `\n\n# Updated declarations\n${updatedDeclarations.map(
            (declaration) =>
              `- ${declaration.name}\n${JSON.stringify(declaration.metadata)}`,
          )}`
        : ""
    }`,
    maxTokens: 8192,
  });

  return object;
}
