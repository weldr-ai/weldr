"use server";

import { createOpenAI } from "@ai-sdk/openai";
import { auth } from "@integramind/auth";
import type {
  AssistantMessageRawContent,
  FuncRequirementsMessage,
} from "@integramind/shared/types";
import { funcRequirementsMessageSchema } from "@integramind/shared/validators/common";
import { type CoreMessage, streamObject } from "ai";
import { createStreamableValue } from "ai/rsc";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  FUNC_DEVELOPER_PROMPT,
  FUNC_REQUIREMENTS_AGENT_PROMPT,
  getGenerateFuncCodePrompt,
} from "~/lib/ai/prompts";
import { api } from "../trpc/server";
import { assistantMessageRawContentToText } from "../utils";
import { generateCode } from "./helpers";

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  compatibility: "strict",
});

export async function generateFunc({
  funcId,
  conversationId,
  messages,
}: {
  funcId: string;
  conversationId: string;
  messages: CoreMessage[];
}) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/auth/sign-in");
  }

  console.log(`[generateFunc] Starting for func ${funcId}`);

  const funcData = await api.funcs.byId({
    id: funcId,
  });

  if (!funcData.name) {
    return {
      status: "error",
      message: "Function name is required",
    };
  }

  const stream = createStreamableValue<FuncRequirementsMessage>();

  (async () => {
    console.log(`[generateFunc] Streaming response for func ${funcId}`);
    const { partialObjectStream } = streamObject({
      model: openai("gpt-4o-2024-11-20"),
      system: FUNC_REQUIREMENTS_AGENT_PROMPT,
      messages: [
        {
          role: "user",
          content: `You are implementing a function called ${funcData?.name} and it has ID: ${funcId}.`,
        },
        ...messages,
      ],
      schema: funcRequirementsMessageSchema,
      onFinish: async ({ usage, object, error }) => {
        console.log(
          `[generateFunc] Completed with usage: ${usage.promptTokens} prompt, ${usage.completionTokens} completion, ${usage.totalTokens} total`,
        );
        console.log(`[generateFunc] Error: ${JSON.stringify(error, null, 2)}`);
        console.log(
          `[generateFunc] Object: ${JSON.stringify(object, null, 2)}`,
        );

        if (object?.message?.type === "message") {
          console.log(
            `[generateFunc] Adding message to conversation for func ${funcId}`,
          );
          api.conversations.addMessage({
            role: "assistant",
            content: assistantMessageRawContentToText(object.message.content),
            rawContent: object.message.content,
            conversationId,
          });
        }

        if (object?.message?.type === "end") {
          console.log("[generateFunc] Processing final requirements");

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
            `[generateFunc] Updating func ${funcId} with gathered requirements`,
          );

          const inputSchema = object.message.content.inputSchema
            ? JSON.parse(object.message.content.inputSchema)
            : undefined;

          const outputSchema = object.message.content.outputSchema
            ? JSON.parse(object.message.content.outputSchema)
            : undefined;

          const internalGraphEdges = object.message.content.internalGraphEdges;

          if (internalGraphEdges && internalGraphEdges.length > 0) {
            await api.funcInternalGraph.addEdges({
              funcId,
              edges: internalGraphEdges,
            });
          }

          if (
            object.message.content.helperFunctionIds &&
            object.message.content.helperFunctionIds.length > 0
          ) {
            await api.funcDependencies.createBulk({
              funcId,
              dependencyFuncIds: object.message.content.helperFunctionIds,
            });
          }

          const generatedFuncCodePrompt = await getGenerateFuncCodePrompt({
            name: funcData?.name ?? "",
            description: assistantMessageRawContentToText(
              object.message.content.description,
            ),
            inputSchema: JSON.stringify(inputSchema),
            outputSchema: JSON.stringify(outputSchema),
            resources: object.message.content.resources,
            logicalSteps: assistantMessageRawContentToText(
              object.message.content.logicalSteps,
            ),
            helperFunctionIds: object.message.content.helperFunctionIds,
            edgeCases: object.message.content.edgeCases,
            errorHandling: object.message.content.errorHandling,
            npmDependencies: object.message.content.npmDependencies as
              | {
                  name: string;
                  version: string;
                }[]
              | undefined,
          });

          const code = await generateCode({
            funcId,
            prompt: generatedFuncCodePrompt,
            systemPrompt: FUNC_DEVELOPER_PROMPT,
          });

          api.funcs.update({
            where: { id: funcId },
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
              npmDependencies: object.message.content.npmDependencies,
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
      stream.update(partialObject as FuncRequirementsMessage);
    }

    console.log(`[generateFunc] Stream completed for func ${funcId}`);
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
