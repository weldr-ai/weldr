"use server";

import { createOpenAI } from "@ai-sdk/openai";
import { auth } from "@integramind/auth";
import type {
  AssistantMessageRawContent,
  FlowInputSchemaMessage,
  FlowOutputSchemaMessage,
  FlowType,
  PrimitiveRequirementsMessage,
} from "@integramind/shared/types";
import {
  flowInputSchemaMessageSchema,
  flowOutputSchemaMessageSchema,
  primitiveRequirementsMessageSchema,
} from "@integramind/shared/validators/common";
import { type CoreMessage, streamObject } from "ai";
import { createStreamableValue } from "ai/rsc";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  FLOW_INPUT_SCHEMA_AGENT_PROMPT,
  FLOW_OUTPUT_SCHEMA_AGENT_PROMPT,
  FUNCTION_DEVELOPER_PROMPT,
  PRIMITIVE_REQUIREMENTS_AGENT_PROMPT,
  getGeneratePrimitiveCodePrompt,
} from "~/lib/ai/prompts";
import { api } from "../trpc/server";
import { assistantMessageRawContentToText, flattenInputSchema } from "../utils";
import { generateCode } from "./helpers";

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  compatibility: "strict",
});

export async function generatePrimitive({
  primitiveId,
  conversationId,
  messages,
}: {
  primitiveId: string;
  conversationId: string;
  messages: CoreMessage[];
}) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/auth/sign-in");
  }

  console.log(`[generatePrimitive] Starting for primitive ${primitiveId}`);

  const primitiveData = await api.primitives.byId({
    id: primitiveId,
  });

  const stream = createStreamableValue();

  (async () => {
    console.log(
      `[generatePrimitive] Streaming response for primitive ${primitiveId}`,
    );
    const { partialObjectStream } = streamObject({
      model: openai("gpt-4o-2024-11-20"),
      system: PRIMITIVE_REQUIREMENTS_AGENT_PROMPT,
      messages: [
        {
          role: "user",
          content: `You are implementing a function called ${primitiveData?.name} and it has ID: ${primitiveId}.`,
        },
        ...messages,
      ],
      schema: primitiveRequirementsMessageSchema,
      onFinish: async ({ usage, object }) => {
        console.log(
          `[generatePrimitive] Completed with usage: ${usage.promptTokens} prompt, ${usage.completionTokens} completion, ${usage.totalTokens} total`,
        );

        if (object?.message?.type === "message") {
          console.log(
            `[generatePrimitive] Adding message to conversation for primitive ${primitiveId}`,
          );
          api.conversations.addMessage({
            role: "assistant",
            content: assistantMessageRawContentToText(object.message.content),
            rawContent: object.message.content,
            conversationId,
          });
        }

        if (object?.message?.type === "end") {
          console.log("[generatePrimitive] Processing final requirements");

          const description: AssistantMessageRawContent = [
            {
              type: "text",
              value: "Generating the following function: ",
            },
            ...object.message.content.description,
          ];

          api.conversations.addMessage({
            role: "assistant",
            content: assistantMessageRawContentToText(description),
            rawContent: description,
            conversationId,
          });

          console.log(
            `[generatePrimitive] Updating primitive ${primitiveId} with gathered requirements`,
          );

          const inputSchema = object.message.content.inputSchema
            ? JSON.parse(object.message.content.inputSchema)
            : undefined;

          const outputSchema = object.message.content.outputSchema
            ? JSON.parse(object.message.content.outputSchema)
            : undefined;

          const flattenedInputSchema = flattenInputSchema({
            id: primitiveId,
            schema: inputSchema,
          });

          const edges: {
            local: string[];
            imported: string[];
          } = {
            local: [],
            imported: [],
          };

          for (const input of flattenedInputSchema) {
            const isLocal = input.refUri.match(
              /^\/schemas\/local\/([^\/]+)\/output\/properties\/([^\/]+)$/,
            );

            const isImported = input.refUri.match(
              /^\/schemas\/imported\/([^\/]+)\/output\/properties\/([^\/]+)$/,
            );

            if (isLocal?.[1]) {
              edges.local.push(isLocal[1]);
            } else if (isImported?.[1]) {
              edges.imported.push(isImported[1]);
            }
          }

          console.log("[generatePrimitive] Creating edges", edges);

          const edgesData = [
            ...edges.local.map((id) => ({
              type: "consumes" as const,
              flowId: primitiveData?.flowId,
              localSourceId: id,
              targetId: primitiveId,
            })),
            ...edges.imported.map((id) => ({
              type: "consumes" as const,
              flowId: primitiveData?.flowId,
              importedSourceId: id,
              targetId: primitiveId,
            })),
            ...(object.message.content.extraUsedUtilities?.local ?? []).map(
              (id) => ({
                type: "requires" as const,
                flowId: primitiveData?.flowId,
                localSourceId: id,
                targetId: primitiveId,
              }),
            ),
            ...(object.message.content.extraUsedUtilities?.imported ?? []).map(
              (id) => ({
                type: "requires" as const,
                flowId: primitiveData?.flowId,
                importedSourceId: id,
                targetId: primitiveId,
              }),
            ),
          ];

          await api.edges.createBulk(edgesData);

          const generatePrimitiveCodePrompt =
            await getGeneratePrimitiveCodePrompt({
              name: primitiveData?.name ?? "",
              description: assistantMessageRawContentToText(
                object.message.content.description,
              ),
              inputSchema: JSON.stringify(inputSchema),
              outputSchema: JSON.stringify(outputSchema),
              resources: object.message.content.resources,
              logicalSteps: assistantMessageRawContentToText(
                object.message.content.logicalSteps,
              ),
              usedLocalUtilitiesIds:
                object.message.content.extraUsedUtilities?.local,
              usedImportedUtilitiesIds:
                object.message.content.extraUsedUtilities?.imported,
              edgeCases: object.message.content.edgeCases,
              errorHandling: object.message.content.errorHandling,
              dependencies: object.message.content.dependencies as
                | {
                    name: string;
                    version: string;
                  }[]
                | undefined,
            });

          const code = await generateCode({
            primitiveId,
            prompt: generatePrimitiveCodePrompt,
            systemPrompt: FUNCTION_DEVELOPER_PROMPT,
          });

          api.primitives.update({
            where: { id: primitiveId },
            payload: {
              inputSchema,
              outputSchema,
              rawDescription: object.message.content.description,
              description: assistantMessageRawContentToText(
                object.message.content.description,
              ),
              resources: object.message.content.resources,
              edgeCases: object.message.content.edgeCases,
              errorHandling: object.message.content.errorHandling,
              logicalSteps: object.message.content.logicalSteps,
              dependencies: object.message.content.dependencies,
              code,
            },
          });

          api.conversations.addMessage({
            role: "assistant",
            content: "Your function has been built successfully!",
            rawContent: [
              {
                type: "text",
                value: "Your function has been built successfully!",
              },
            ],
            conversationId,
          });
        }
      },
    });

    for await (const partialObject of partialObjectStream) {
      stream.update(partialObject as PrimitiveRequirementsMessage);
    }

    console.log(
      `[generatePrimitive] Stream completed for primitive ${primitiveId}`,
    );
    stream.done();
  })();

  return stream.value;
}

export async function generateFlowInputSchema({
  flowId,
  flowType,
  conversationId,
  messages,
}: {
  flowId: string;
  flowType: FlowType;
  conversationId: string;
  messages: CoreMessage[];
}) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/auth/sign-in");
  }

  console.log(`[generateFlowInputsSchemas] Starting for ${flowType} ${flowId}`);
  const stream = createStreamableValue<FlowInputSchemaMessage>();

  (async () => {
    console.log(
      "[generateFlowInputsSchemas] Streaming response for input schema",
    );
    const { partialObjectStream } = streamObject({
      model: openai("gpt-4o"),
      system: FLOW_INPUT_SCHEMA_AGENT_PROMPT,
      messages: [
        {
          role: "user",
          content: `I want to create inputs for ${flowType} (ID: ${flowId})`,
        },
        ...messages,
      ],
      schema: flowInputSchemaMessageSchema,
      onFinish: ({ usage, object }) => {
        console.log(
          `[generateFlowInputsSchemas] Completed with usage: ${usage.promptTokens} prompt, ${usage.completionTokens} completion, ${usage.totalTokens} total`,
        );

        if (object?.message?.type === "message") {
          console.log(
            "[generateFlowInputsSchemas] Adding message to conversation",
          );
          api.conversations.addMessage({
            role: "assistant",
            content: assistantMessageRawContentToText(object.message.content),
            rawContent: object.message.content,
            conversationId,
          });
        }

        if (object?.message?.type === "end") {
          console.log(
            `[generateFlowInputsSchemas] Processing final input schema for ${flowType} ${flowId}`,
          );

          const description: AssistantMessageRawContent = [
            {
              type: "text",
              value: "Generating the following input schema: ",
            },
            ...object.message.content.description,
          ];

          api.conversations.addMessage({
            role: "assistant",
            content: assistantMessageRawContentToText(description),
            rawContent: description,
            conversationId,
          });

          console.log(
            `[generateFlowInputsSchemas] Updating ${flowType} ${flowId} with generated input schema`,
          );

          api.flows.update({
            where: { id: flowId },
            payload: {
              type: "endpoint",
              inputSchema: JSON.parse(object.message.content.inputSchema),
            },
          });

          api.conversations.addMessage({
            role: "assistant",
            content: "Your input schema has been built successfully!",
            rawContent: [
              {
                type: "text",
                value: "Your input schema has been built successfully!",
              },
            ],
            conversationId,
          });
        }
      },
    });

    for await (const partialObject of partialObjectStream) {
      stream.update(partialObject as FlowInputSchemaMessage);
    }

    console.log(
      `[generateFlowInputsSchemas] Stream completed for ${flowType} ${flowId}`,
    );

    stream.done();
  })();

  return stream.value;
}

export async function generateFlowOutputsSchemas({
  flowId,
  flowType,
  messages,
  conversationId,
}: {
  flowId: string;
  flowType: FlowType;
  messages: CoreMessage[];
  conversationId: string;
}) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/auth/sign-in");
  }

  console.log(`[generateFlowOutputsSchemas] Starting for flow ${flowId}`);
  const stream = createStreamableValue<FlowOutputSchemaMessage>();

  (async () => {
    console.log(
      `[generateFlowOutputsSchemas] Streaming response for ${flowType} ${flowId}`,
    );
    const { partialObjectStream } = streamObject({
      model: openai("gpt-4o"),
      system: FLOW_OUTPUT_SCHEMA_AGENT_PROMPT,
      messages: [
        {
          role: "user",
          content: `I want to create outputs for ${flowType} (ID: ${flowId})`,
        },
        ...messages,
      ],
      schema: flowOutputSchemaMessageSchema,
      onFinish: ({ usage, object }) => {
        console.log(
          `[generateFlowOutputsSchemas] Completed with usage: ${usage.promptTokens} prompt, ${usage.completionTokens} completion, ${usage.totalTokens} total`,
        );

        if (object?.message?.type === "message") {
          console.log(
            "[generateFlowOutputsSchemas] Adding message to conversation",
          );

          api.conversations.addMessage({
            role: "assistant",
            content: assistantMessageRawContentToText(object.message.content),
            rawContent: object.message.content,
            conversationId,
          });
        }

        if (object?.message?.type === "end") {
          console.log(
            `[generateFlowOutputsSchemas] Processing final output schema for ${flowType} ${flowId}`,
          );
          const description: AssistantMessageRawContent = [
            {
              type: "text",
              value: "Generating the following output schema: ",
            },
            ...object.message.content.description,
          ];

          api.conversations.addMessage({
            role: "assistant",
            content: assistantMessageRawContentToText(description),
            rawContent: description,
            conversationId,
          });

          console.log(
            `[generateFlowOutputsSchemas] Updating ${flowType} ${flowId} with generated output schema`,
          );

          api.flows.update({
            where: { id: flowId },
            payload: {
              type: "endpoint",
              outputSchema: JSON.parse(object.message.content.outputSchema),
            },
          });

          api.conversations.addMessage({
            role: "assistant",
            content: "Your output schema has been built successfully!",
            rawContent: [
              {
                type: "text",
                value: "Your output schema has been built successfully!",
              },
            ],
            conversationId,
          });
        }
      },
    });

    for await (const partialObject of partialObjectStream) {
      stream.update(partialObject as FlowOutputSchemaMessage);
    }

    console.log(
      `[generateFlowOutputsSchemas] Stream completed for ${flowType} ${flowId}`,
    );

    stream.done();
  })();

  return stream.value;
}

// export async function generateFlowCode({
//   flowId,
// }: {
//   flowId: string;
// }) {
//   try {
//     const result = await api.flows.byIdWithAssociatedData({
//       id: flowId,
//     });

//     if (result.type !== "endpoint") {
//       throw new Error("Flow is not an endpoint");
//     }

//     const prompt = getFlowComposerAgentPrompt({
//       flow: {
//         id: result.id,
//         path: (result.metadata as EndpointFlow["metadata"]).path,
//         method: (result.metadata as EndpointFlow["metadata"]).method,
//         inputSchema: result.inputSchema,
//         outputSchema: result.outputSchema,
//       },
//       nodes: result.nodes,
//     });

//     const code = await generateCode({
//       functionId: result.id,
//       prompt,
//       systemPrompt: FLOW_COMPOSER_AGENT_PROMPT,
//     });

//     await api.flows.update({
//       where: { id: flowId },
//       payload: {
//         type: "endpoint",
//         code,
//       },
//     });
//   } catch (error) {
//     console.error(error);
//     return {
//       status: "error",
//       message: "Failed to compile flow",
//     };
//   }
// }
