import { declarationSpecsV1Schema } from "@weldr/shared/validators/declarations/index";

import { registry } from "../registry";

import { streamObject } from "ai";
import { z } from "zod";
import { prompts } from "../prompts";

export const declarationSpecsWithDependenciesSchema =
  declarationSpecsV1Schema.and(
    z.object({
      dependencies: z
        .object({
          internal: z
            .object({
              importPath: z
                .string()
                .describe(
                  "The absolute path to the file containing the declaration. Alias @/ imports are resolved to /src/**/*",
                ),
              dependsOn: z
                .array(z.string())
                .describe("The list of declarations imported from that path"),
            })
            .array()
            .describe(
              `A list of internal files that this declaration depends on
      Some dependencies are not imported from a file like REST API routes. YOU MUST INCLUDE THEM.
      For example, if a component uses a REST API route, you must include the REST API route in the internal dependencies
      With importPath: "src/app/api/PATH_TO_THE_ROUTE" and dependsOn: ["HTTP_METHOD:[OPEN_API_PATH]"]
      For example:
      {
        importPath: "src/app/api/users/[id]/route.ts",
        dependsOn: ["GET:/users/{id}"],
      }`,
            ),
          external: z
            .object({
              name: z.string().describe("The package name"),
              importPath: z.string().describe("The import path"),
              dependsOn: z
                .array(z.string())
                .describe("The list of declarations imported from that path"),
            })
            .array()
            .describe(
              "A list of npm packages that this declaration depends on",
            ),
        })
        .describe(
          "A list of dependencies for the declaration. Internal dependencies are files in the project, and external dependencies are npm packages.",
        ),
      isNode: z.boolean().describe(
        `Whether the declaration is a node.

  What are the nodes?
  - All endpoints and pages are nodes by default.
  - UI components that are visual are nodes.
  - All models are nodes by default.
  - Functions that are DIRECTLY part of the business logic are nodes.

  What are NOT nodes?
  - Other declarations are not nodes.
  - Layouts ARE NOT nodes.
  - Components that are not visual are not nodes.
  - Functions that are not part of the business logic are not nodes.`,
      ),
    }),
  );

export async function enricher({
  projectId,
  path,
  currentContent,
  previousContent,
}: {
  projectId: string;
  path: string;
  currentContent: string;
  previousContent?: string;
}) {
  const result = streamObject({
    model: registry.languageModel("openai:gpt-4.1"),
    schema: z.object({
      declarations: declarationSpecsWithDependenciesSchema
        .array()
        .describe("The list of declaration specs for the current file"),
      metadata: z
        .object({
          updatedDeclarations: z
            .string()
            .array()
            .describe("The list of declarations that have been updated"),
          deletedDeclarations: z
            .string()
            .array()
            .describe("The list of declarations that have been deleted"),
        })
        .describe("The metadata for the current file"),
    }),
    system: prompts.enricher,
    prompt: `# Code

${
  previousContent
    ? `${path}
\`\`\`
${previousContent}
\`\`\`
`
    : "There is no previous file"
}

  Current file:
  ${path}
\`\`\`
${currentContent}
\`\`\``,
    onError: (error) => {
      console.error(JSON.stringify(error, null, 2));
    },
    onFinish: ({ object }) => {
      console.log(JSON.stringify(object, null, 2));
    },
  });

  for await (const _ of result.partialObjectStream) {
    // DO NOTHING
  }

  const data = await result.object;

  const usage = await result.usage;

  console.log(
    `[enricher:${projectId}:${path}] prompt tokens: ${usage.promptTokens}, completion tokens: ${usage.completionTokens}, total tokens: ${usage.totalTokens}`,
  );

  return data;
}
