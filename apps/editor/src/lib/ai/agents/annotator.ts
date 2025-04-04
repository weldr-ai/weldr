import { declarationMetadataSchema } from "@weldr/shared/validators/declarations/index";
import { z } from "zod";

import { registry } from "../registry";

import type { InferSelectModel } from "@weldr/db";
import type { DeclarationDependency, declarations } from "@weldr/db/schema";
import { streamObject } from "ai";

export async function annotator({
  projectId,
  file,
  newDeclarations,
  previousVersionDeclarations,
}: {
  projectId: string;
  file: {
    path: string;
    content: string;
  };
  newDeclarations: Record<string, DeclarationDependency[]>;
  previousVersionDeclarations: InferSelectModel<typeof declarations>[];
}) {
  const result = streamObject({
    model: registry.languageModel("anthropic:claude-3-5-sonnet-latest"),
    output: "array",
    schema: z
      .object({
        metadata: declarationMetadataSchema.describe(
          "The declaration metadata",
        ),
        isNode: z.boolean().describe(
          `Whether the declaration is a node.
- What are the nodes?
- All endpoints and pages are nodes by default.
- Functions that are DIRECTLY part of the business logic are nodes.
- Reusable UI components that are important, for example, components with effects.
- What are the non-nodes?
- UI Layouts are not nodes.
- Context Providers are not nodes.
- Utility functions are not nodes.
- Models are not nodes.
- Other declarations are not nodes.`,
        ),
      })
      .describe(
        "The list of metadata of the exported declarations. Create the metadata for the provided declarations only. It will be used to generate the documentation. MUST be a valid JSON object not a string.",
      ),
    system: `Please, create metadata for the provided declarations based on the code.
      You must create metadata for new declarations and update the metadata for updated declarations if needed.
      Important:
      - We are using next.js with app router.
      - Pages and layouts will ONLY exist under src/app.
      - REST API routes will ONLY exist under src/app/api.
      - The codebase is using typescript.
      - You SHOULD NOT create new metadata for updated declarations if it is not needed.
      - Make sure to classify the declarations as nodes or non-nodes.
      - The isNode flag is part of the parent object, not the metadata object. YOU MUST NOT INCLUDE IT IN THE METADATA.`,
    prompt: `# Code

${file.path}
\`\`\`
${file.content}
\`\`\`

${
  Object.keys(newDeclarations).length > 0
    ? `# New declarations\n${Object.keys(newDeclarations).join("\n")}`
    : ""
}${
  previousVersionDeclarations.length > 0
    ? `\n\n# Updated declarations\n${previousVersionDeclarations
        .map((declaration) => JSON.stringify(declaration, null, 2))
        .join("\n\n")}`
    : ""
}`,
  });

  for await (const _ of result.partialObjectStream) {
    console.log(`[annotator:${projectId}] Streaming...`);
  }

  const data = await result.object;
  return data;
}
