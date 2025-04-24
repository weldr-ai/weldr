import { declarationSpecsV1Schema } from "@weldr/shared/validators/declarations/index";

import { registry } from "../registry";

import type { DeclarationDependency, declarations } from "@weldr/db/schema";
import { streamObject } from "ai";

export async function enricher({
  projectId,
  file,
  newDeclarations,
  updatedDeclarations,
}: {
  projectId: string;
  file: {
    path: string;
    content: string;
  };
  newDeclarations: Record<string, DeclarationDependency[]>;
  updatedDeclarations: (typeof declarations.$inferSelect)[];
}) {
  const result = streamObject({
    output: "array",
    model: registry.languageModel("anthropic:claude-3-5-sonnet-latest"),
    schema: declarationSpecsV1Schema.describe("The list of declaration specs"),
    system: `Please, create specs for the provided declarations based on the code.
      You must create specs for new declarations and update the specs for updated declarations if needed.
      Important:
      - We are using next.js with app router.
      - Pages and layouts will ONLY exist under src/app.
      - REST API routes will ONLY exist under src/app/api.
      - The codebase is using typescript.
      - You SHOULD NOT create new metadata for current declarations if it is not needed.
      - Make sure to classify the declarations as nodes or non-nodes.
      - The isNode flag is part of the parent object, not the metadata object. YOU MUST NOT INCLUDE IT IN THE METADATA.`,
    prompt: `# Code

${file.path}
\`\`\`
${file.content}
\`\`\`

${
  Object.keys(newDeclarations).length > 0
    ? `# Declarations to enrich\n${Object.keys(newDeclarations).join("\n")}`
    : ""
}${
  updatedDeclarations.length > 0
    ? `\n\n# Declarations to update\n${updatedDeclarations
        .map(
          (d) =>
            `- ${d.name}
\`\`\`
${d.specs}
\`\`\`
`,
        )
        .join("\n")}`
    : ""
}`,
  });

  for await (const _ of result.partialObjectStream) {
    // DO NOTHING
  }

  const data = await result.object;

  const usage = await result.usage;

  console.log(
    `[enricher:${projectId}:${file.path}] prompt tokens: ${usage.promptTokens}, completion tokens: ${usage.completionTokens}, total tokens: ${usage.totalTokens}`,
  );

  return data;
}
