"use server";

import { createOpenAI } from "@ai-sdk/openai";
import { auth } from "@integramind/auth";
import type {
  AssistantMessageRawContent,
  FlowInputSchemaMessage,
  FlowOutputSchemaMessage,
  FuncRequirementsMessage,
} from "@integramind/shared/types";
import {
  flowInputSchemaMessageSchema,
  flowOutputSchemaMessageSchema,
  funcRequirementsMessageSchema,
} from "@integramind/shared/validators/common";
import { type CoreMessage, streamObject } from "ai";
import { createStreamableValue } from "ai/rsc";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  ENDPOINT_INPUT_SCHEMA_AGENT_PROMPT,
  ENDPOINT_OUTPUT_SCHEMA_AGENT_PROMPT,
  FLOW_INPUT_SCHEMA_AGENT_PROMPT,
  FLOW_OUTPUT_SCHEMA_AGENT_PROMPT,
  FUNC_DEVELOPER_PROMPT,
  FUNC_REQUIREMENTS_AGENT_PROMPT,
  getGenerateFuncCodePrompt,
} from "~/lib/ai/prompts";
import { api } from "../trpc/server";
import { assistantMessageRawContentToText, flattenInputSchema } from "../utils";
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

          const flattenedInputSchema = flattenInputSchema({
            id: funcId,
            schema: inputSchema,
          });

          const edges: {
            local: Set<string>;
            imported: Set<string>;
          } = {
            local: new Set(),
            imported: new Set(),
          };

          for (const input of flattenedInputSchema) {
            const isLocal = input.refUri.match(
              /^\/schemas\/local\/([^\/]+)\/output\/properties\/([^\/]+)$/,
            );

            const isImported = input.refUri.match(
              /^\/schemas\/imported\/([^\/]+)\/output\/properties\/([^\/]+)$/,
            );

            if (isLocal?.[1]) {
              edges.local.add(isLocal[1]);
            } else if (isImported?.[1]) {
              edges.imported.add(isImported[1]);
            }
          }

          console.log("[generateFunc] Creating edges", edges);

          const edgesData = [
            ...Array.from(edges.local).map((id) => ({
              type: "consumes" as const,
              flowId: funcData?.flowId,
              localSourceId: id,
              targetId: funcId,
            })),
            ...Array.from(edges.imported).map((id) => ({
              type: "consumes" as const,
              flowId: funcData?.flowId,
              importedSourceId: id,
              targetId: funcId,
            })),
            ...(object.message.content.extraUsedUtilities?.local ?? []).map(
              (id) => ({
                type: "requires" as const,
                flowId: funcData?.flowId,
                localSourceId: id,
                targetId: funcId,
              }),
            ),
            ...(object.message.content.extraUsedUtilities?.imported ?? []).map(
              (id) => ({
                type: "requires" as const,
                flowId: funcData?.flowId,
                importedSourceId: id,
                targetId: funcId,
              }),
            ),
          ];

          if (edgesData.length > 0) {
            await api.edges.createBulk(edgesData);
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
      stream.update(partialObject as FuncRequirementsMessage);
    }

    console.log(`[generateFunc] Stream completed for func ${funcId}`);
    stream.done();
  })();

  return stream.value;
}

export async function generateFlowInputSchema({
  flowId,
  conversationId,
  messages,
}: {
  flowId: string;
  conversationId: string;
  messages: CoreMessage[];
}) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/auth/sign-in");
  }

  const flowData = await api.flows.byId({
    id: flowId,
  });

  if (!flowData.name) {
    return {
      status: "error",
      message: "Flow name is required",
    };
  }

  if (
    flowData.type === "endpoint" &&
    (!flowData.metadata.path || !flowData.metadata.method)
  ) {
    return {
      status: "error",
      message: "Flow path and method are required",
    };
  }

  console.log(
    `[generateFlowInputsSchemas] Starting for ${flowData.type} ${flowId}`,
  );
  const stream = createStreamableValue<FlowInputSchemaMessage>();

  (async () => {
    console.log(
      "[generateFlowInputsSchemas] Streaming response for input schema",
    );
    const { partialObjectStream } = streamObject({
      model: openai("gpt-4o"),
      system:
        flowData.type === "endpoint"
          ? ENDPOINT_INPUT_SCHEMA_AGENT_PROMPT
          : FLOW_INPUT_SCHEMA_AGENT_PROMPT,
      messages: [
        {
          role: "user",
          content: `I want to create inputs for flow ${flowData.name} (ID: ${flowId}) of type ${flowData.type}${
            flowData.type === "endpoint"
              ? ` with path ${flowData.metadata.path}`
              : ""
          }`,
        },
        ...messages,
      ],
      schema: flowInputSchemaMessageSchema,
      onFinish: ({ usage, object, error }) => {
        console.log(
          `[generateFlowInputsSchemas] Completed with usage: ${usage.promptTokens} prompt, ${usage.completionTokens} completion, ${usage.totalTokens} total`,
        );
        console.log(
          `[generateFlowInputsSchemas] Error: ${JSON.stringify(error, null, 2)}`,
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
            `[generateFlowInputsSchemas] Processing final input schema for ${flowData.type} ${flowId}`,
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
            `[generateFlowInputsSchemas] Updating ${flowData.type} ${flowId} with generated input schema`,
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
      `[generateFlowInputsSchemas] Stream completed for ${flowData.type} ${flowId}`,
    );

    stream.done();
  })();

  return stream.value;
}

export async function generateFlowOutputSchema({
  flowId,
  messages,
  conversationId,
}: {
  flowId: string;
  messages: CoreMessage[];
  conversationId: string;
}) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/auth/sign-in");
  }

  const flowData = await api.flows.byId({
    id: flowId,
  });

  if (!flowData.name) {
    return {
      status: "error",
      message: "Flow name is required",
    };
  }

  console.log(`[generateFlowOutputSchema] Starting for flow ${flowId}`);
  const stream = createStreamableValue<FlowOutputSchemaMessage>();

  (async () => {
    console.log(
      `[generateFlowOutputSchema] Streaming response for ${flowData.type} ${flowId}`,
    );
    const { partialObjectStream } = streamObject({
      model: openai("gpt-4o"),
      system:
        flowData.type === "endpoint"
          ? ENDPOINT_OUTPUT_SCHEMA_AGENT_PROMPT
          : FLOW_OUTPUT_SCHEMA_AGENT_PROMPT,
      messages: [
        {
          role: "user",
          content: `I want to create outputs for flow ${flowData.name} (ID: ${flowId}) of type ${flowData.type}`,
        },
        ...messages,
      ],
      schema: flowOutputSchemaMessageSchema,
      onFinish: ({ usage, object, error }) => {
        console.log(
          `[generateFlowOutputSchema] Completed with usage: ${usage.promptTokens} prompt, ${usage.completionTokens} completion, ${usage.totalTokens} total`,
        );
        console.log(
          `[generateFlowOutputSchema] Error: ${JSON.stringify(error, null, 2)}`,
        );

        if (object?.message?.type === "message") {
          console.log(
            "[generateFlowOutputSchema] Adding message to conversation",
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
            `[generateFlowOutputSchema] Processing final output schema for ${flowData.type} ${flowId}`,
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
            `[generateFlowOutputSchema] Updating ${flowData.type} ${flowId} with generated output schema`,
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
      `[generateFlowOutputSchema] Stream completed for ${flowData.type} ${flowId}`,
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
