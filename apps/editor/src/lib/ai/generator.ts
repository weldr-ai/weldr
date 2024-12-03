"use server";

import { createOpenAI } from "@ai-sdk/openai";
import { auth } from "@integramind/auth";
import type {
  AssistantMessageRawContent,
  PrimitiveRequirementsMessage,
} from "@integramind/shared/types";
import { primitiveRequirementsMessageSchema } from "@integramind/shared/validators/common";
import { type CoreMessage, streamObject } from "ai";
import { createStreamableValue } from "ai/rsc";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  FUNCTION_DEVELOPER_PROMPT,
  getGeneratePrimitiveCodePrompt,
  getPrimitiveRequirementsAgentPrompt,
} from "~/lib/ai/prompts";
import { api } from "../trpc/server";
import { assistantMessageRawContentToText } from "../utils";
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

  const stream = createStreamableValue<PrimitiveRequirementsMessage>();

  (async () => {
    console.log("[generatePrimitive] Streaming response from OpenAI");
    const { partialObjectStream } = await streamObject({
      model: openai("gpt-4o"),
      system: getPrimitiveRequirementsAgentPrompt(primitiveId),
      messages,
      schema: primitiveRequirementsMessageSchema,
      onFinish: async ({ usage, object, error }) => {
        console.log(
          `[generatePrimitive] Completed with usage: ${usage.promptTokens} prompt, ${usage.completionTokens} completion, ${usage.totalTokens} total`,
        );

        if (object?.message?.type === "message") {
          console.log("[generatePrimitive] Adding message to conversation");
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

          try {
            for (const usedPrimitiveId of object.message.content
              .usedPrimitiveIds ?? []) {
              await api.dependencies.create({
                targetPrimitiveId: primitiveId,
                sourcePrimitiveId: usedPrimitiveId,
              });
            }

            for (const usedUtilityId of object.message.content.usedUtilityIds ??
              []) {
              await api.dependencies.create({
                targetPrimitiveId: primitiveId,
                sourceUtilityId: usedUtilityId,
              });
            }
          } catch (error) {
            console.error(
              `[generatePrimitive] Error creating dependency for primitive ${primitiveId}: ${error}`,
            );
          }

          const generatePrimitiveCodePrompt =
            await getGeneratePrimitiveCodePrompt({
              name: primitiveData?.name ?? "",
              description: assistantMessageRawContentToText(
                object.message.content.description,
              ),
              inputSchema: object.message.content.inputSchema,
              outputSchema: object.message.content.outputSchema,
              resources: object.message.content.resources,
              usedPrimitiveIds: object.message.content.usedPrimitiveIds,
              usedUtilityIds: object.message.content.usedUtilityIds,
              logicalSteps: assistantMessageRawContentToText(
                object.message.content.logicalSteps,
              ),
              edgeCases: object.message.content.edgeCases,
              errorHandling: object.message.content.errorHandling,
              packages: object.message.content.packages as
                | {
                    name: string;
                    version: string;
                  }[]
                | undefined,
            });

          console.log(`[generatePrimitive] ${generatePrimitiveCodePrompt}`);

          const code = await generateCode({
            primitiveId,
            prompt: generatePrimitiveCodePrompt,
            systemPrompt: FUNCTION_DEVELOPER_PROMPT,
          });

          api.primitives.update({
            where: { id: primitiveId },
            payload: {
              inputSchema: object.message.content.inputSchema
                ? JSON.parse(object.message.content.inputSchema)
                : undefined,
              outputSchema: object.message.content.outputSchema
                ? JSON.parse(object.message.content.outputSchema)
                : undefined,
              rawDescription: object.message.content.description,
              description: assistantMessageRawContentToText(
                object.message.content.description,
              ),
              resources: object.message.content.resources,
              edgeCases: object.message.content.edgeCases,
              errorHandling: object.message.content.errorHandling,
              logicalSteps: object.message.content.logicalSteps,
              packages: object.message.content.packages,
              code,
            },
          });

          api.conversations.addMessage({
            role: "assistant",
            content: "Your primitive has been built successfully!",
            rawContent: [
              {
                type: "text",
                value: "Your primitive has been built successfully!",
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
