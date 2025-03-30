import { declarationMetadataSchema } from "@weldr/shared/validators/declarations/index";
import { z } from "zod";

import { registry } from "../registry";

import type { InferSelectModel } from "@weldr/db";
import type { DeclarationDependency, declarations } from "@weldr/db/schema";
import { streamObject } from "ai";

export async function annotator({
  projectId,
  file,
  processedDeclarations,
  previousVersionDeclarations,
}: {
  projectId: string;
  file: {
    path: string;
    content: string;
  };
  processedDeclarations: {
    newDeclarations: Record<string, DeclarationDependency[]>;
    deletedDeclarations: Record<string, DeclarationDependency[]>;
  };
  previousVersionDeclarations: InferSelectModel<typeof declarations>[];
}) {
  const { object, usage } = streamObject({
    model: registry.languageModel("anthropic:claude-3-5-sonnet-latest"),
    schema: z.object({
      data: z
        .object({
          metadata: declarationMetadataSchema.describe(
            "The declaration metadata",
          ),
          isNode: z.boolean().describe(
            `Whether the declaration is a node.
- What are the nodes?
  - All endpoints and pages are nodes by default.
  - Functions that are DIRECTLY part of the business logic are nodes.
  - Reusable UI components that are visual are nodes.
- What are the non-nodes?
  - UI Layouts are not nodes.
  - Context Providers are not nodes.
  - Utility functions are not nodes.
  - Models are not nodes.
  - Other declarations are not nodes.`,
          ),
        })
        .array()
        .describe(
          "The list of metadata of the exported declarations. Create the metadata for the provided declarations only. It will be used to generate the documentation. MUST be a valid JSON object not a string.",
        ),
    }),
    system: `Please, create metadata for the provided declarations based on the code.
      You must create metadata for new declarations and update the metadata for updated declarations if needed.
      Important:
      - We are using next.js with app router.
      - Pages and layouts will only exist under src/app.
      - REST API routes will only exist under src/app/api.`,
    prompt: `# Code

${file.path}
\`\`\`
${file.content}
\`\`\`

${
  Object.keys(processedDeclarations.newDeclarations).length > 0
    ? `# New declarations\n${Object.keys(
        processedDeclarations.newDeclarations,
      ).join("\n")}`
    : ""
}${
  previousVersionDeclarations.length > 0
    ? `\n\n# Updated declarations\n${previousVersionDeclarations.map(
        (declaration) =>
          `- ${declaration.name}\n${JSON.stringify(declaration.metadata)}`,
      )}`
    : ""
}`,
  });

  const usageData = await usage;

  // Log usage
  console.log(
    `[coder:${projectId}] Annotation usage Prompt: ${usageData.promptTokens} Completion: ${usageData.completionTokens} Total: ${usageData.totalTokens}`,
  );

  return (await object).data;
}
