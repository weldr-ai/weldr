"use server";

import { createOpenAI } from "@ai-sdk/openai";
import { auth } from "@integramind/auth";
import type {
  AssistantMessageRawContent,
  EndpointFlow,
  FlowInputSchemaMessage,
  FlowOutputSchemaMessage,
  FunctionRequirementsMessage,
} from "@integramind/shared/types";
import {
  flowInputSchemaMessageSchema,
  flowOutputSchemaMessageSchema,
  functionRequirementsMessageSchema,
} from "@integramind/shared/validators/common";
import { type CoreMessage, streamObject } from "ai";
import { createStreamableValue } from "ai/rsc";
import { redirect } from "next/navigation";
import {
  FLOW_COMPOSER_AGENT_PROMPT,
  FUNCTION_DEVELOPER_PROMPT,
  getFlowComposerAgentPrompt,
  getFlowInputSchemaAgentPrompt,
  getFlowOutputSchemaAgentPrompt,
  getFunctionRequirementsAgentPrompt,
  getGenerateFunctionCodePrompt,
} from "~/lib/ai/prompts";
import { api } from "../trpc/server";
import { rawMessageContentToText } from "../utils";
import { generateCode } from "./helpers";

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  compatibility: "strict",
});

export async function generateFunction({
  functionId,
  conversationId,
  messages,
}: {
  functionId: string;
  conversationId: string;
  messages: CoreMessage[];
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  console.log(
    `[gatherFunctionRequirements] Starting for function ${functionId}`,
  );
  const functionData = await api.primitives.byId({
    id: functionId,
  });

  const stream = createStreamableValue<FunctionRequirementsMessage>();

  (async () => {
    console.log("[gatherFunctionRequirements] Streaming response from OpenAI");
    const { partialObjectStream } = await streamObject({
      model: openai("gpt-4o"),
      system: getFunctionRequirementsAgentPrompt(functionId),
      messages,
      schema: functionRequirementsMessageSchema,
      onFinish: async ({ usage, object, error }) => {
        console.log(
          `[gatherFunctionRequirements] Completed with usage: ${usage.promptTokens} prompt, ${usage.completionTokens} completion, ${usage.totalTokens} total`,
        );
        console.log(error);
        console.log(JSON.stringify(object, null, 2));

        if (object?.message?.type === "message") {
          console.log(
            "[gatherFunctionRequirements] Adding message to conversation",
          );
          api.conversations.addMessage({
            role: "assistant",
            content: rawMessageContentToText(object.message.content),
            rawContent: object.message.content,
            conversationId,
          });
        }

        if (object?.message?.type === "end") {
          console.log(
            "[gatherFunctionRequirements] Processing final requirements",
          );
          const description: AssistantMessageRawContent = [
            {
              type: "text",
              value: "Generating the following function: ",
            },
            ...object.message.content.description,
          ];

          api.conversations.addMessage({
            role: "assistant",
            content: rawMessageContentToText(description),
            rawContent: description,
            conversationId,
          });

          console.log(
            `[gatherFunctionRequirements] Updating function ${functionId} with gathered requirements`,
          );

          const generateFunctionCodePrompt =
            await getGenerateFunctionCodePrompt({
              name: functionData?.name ?? "",
              description: rawMessageContentToText(
                object.message.content.description,
              ),
              inputSchema: object.message.content.inputSchema,
              outputSchema: object.message.content.outputSchema,
              resources: object.message.content.resources,
              logicalSteps: rawMessageContentToText(
                object.message.content.logicalSteps,
              ),
              edgeCases: object.message.content.edgeCases,
              errorHandling: object.message.content.errorHandling,
              dependencies: object.message.content.dependencies as
                | {
                    name: string;
                    version: string;
                  }[]
                | undefined,
            });

          console.log(generateFunctionCodePrompt);

          const code = await generateCode({
            functionId,
            prompt: generateFunctionCodePrompt,
            systemPrompt: FUNCTION_DEVELOPER_PROMPT,
          });

          api.primitives.update({
            where: { id: functionId },
            payload: {
              type: "function",
              metadata: {
                inputSchema: object.message.content.inputSchema
                  ? JSON.parse(object.message.content.inputSchema)
                  : undefined,
                outputSchema: object.message.content.outputSchema
                  ? JSON.parse(object.message.content.outputSchema)
                  : undefined,
                rawDescription: object.message.content.description,
                description: rawMessageContentToText(
                  object.message.content.description,
                ),
                resources: object.message.content.resources,
                edgeCases: object.message.content.edgeCases,
                errorHandling: object.message.content.errorHandling,
                logicalSteps: object.message.content.logicalSteps,
                dependencies: object.message.content.dependencies,
                code,
              },
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
      stream.update(partialObject as FunctionRequirementsMessage);
    }

    console.log(
      `[gatherFunctionRequirements] Stream completed for function ${functionId}`,
    );
    stream.done();
  })();

  return stream.value;
}

export async function generateFlowInputsSchemas({
  flowId,
  conversationId,
  messages,
}: {
  flowId: string;
  conversationId: string;
  messages: CoreMessage[];
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  console.log(`[generateFlowInputsSchemas] Starting for flow ${flowId}`);
  const stream = createStreamableValue<FlowInputSchemaMessage>();

  (async () => {
    console.log(
      "[generateFlowInputsSchemas] Streaming response from OpenAI for input schema",
    );
    const { partialObjectStream } = await streamObject({
      model: openai("gpt-4o"),
      system: getFlowInputSchemaAgentPrompt(flowId),
      messages,
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
            content: rawMessageContentToText(object.message.content),
            rawContent: object.message.content,
            conversationId,
          });
        }

        if (object?.message?.type === "end") {
          console.log(
            "[generateFlowInputsSchemas] Processing final input schema",
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
            content: rawMessageContentToText(description),
            rawContent: description,
            conversationId,
          });

          console.log(
            `[generateFlowInputsSchemas] Updating flow ${flowId} with generated input schema`,
          );

          api.flows.update({
            where: { id: flowId },
            payload: {
              type: "endpoint",
              inputSchema: JSON.parse(object.message.content.inputSchema),
              validationSchema: object.message.content.zodSchema,
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
      `[generateFlowInputsSchemas] Stream completed for flow ${flowId}`,
    );

    stream.done();
  })();

  return stream.value;
}

export async function generateFlowOutputsSchemas({
  flowId,
  messages,
  conversationId,
}: {
  flowId: string;
  messages: CoreMessage[];
  conversationId: string;
}) {
  console.log(conversationId);

  const session = await auth();

  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  console.log(`[generateFlowOutputsSchemas] Starting for flow ${flowId}`);
  const stream = createStreamableValue<FlowOutputSchemaMessage>();

  (async () => {
    console.log(
      "[generateFlowOutputsSchemas] Streaming response from OpenAI for output schema",
    );
    const { partialObjectStream } = await streamObject({
      model: openai("gpt-4o"),
      system: getFlowOutputSchemaAgentPrompt(flowId),
      messages,
      schema: flowOutputSchemaMessageSchema,
      onFinish: ({ usage, object }) => {
        console.log(
          `[generateFlowOutputsSchemas] Completed with usage: ${usage.promptTokens} prompt, ${usage.completionTokens} completion, ${usage.totalTokens} total`,
        );
        console.log(JSON.stringify(object, null, 2));

        if (object?.message?.type === "message") {
          console.log(
            "[generateFlowOutputsSchemas] Adding message to conversation",
          );

          api.conversations.addMessage({
            role: "assistant",
            content: rawMessageContentToText(object.message.content),
            rawContent: object.message.content,
            conversationId,
          });
        }

        if (object?.message?.type === "end") {
          console.log(
            "[generateFlowOutputsSchemas] Processing final output schema",
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
            content: rawMessageContentToText(description),
            rawContent: description,
            conversationId,
          });

          console.log(
            `[generateFlowOutputsSchemas] Updating flow ${flowId} with generated output schema`,
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
      `[generateFlowOutputsSchemas] Stream completed for flow ${flowId}`,
    );

    stream.done();
  })();

  return stream.value;
}

export async function generateFlowCode({
  flowId,
}: {
  flowId: string;
}) {
  try {
    const result = await api.flows.byIdWithPrimitivesAndEdges({
      id: flowId,
    });

    if (result.type !== "endpoint") {
      throw new Error("Flow is not an endpoint");
    }

    const prompt = getFlowComposerAgentPrompt({
      flow: {
        id: result.id,
        path: (result.metadata as EndpointFlow["metadata"]).path,
        method: (result.metadata as EndpointFlow["metadata"]).method,
        inputSchema: result.inputSchema,
        outputSchema: result.outputSchema,
      },
      functions: result.functionPrimitives,
      edges: result.edges.map((edge) => ({
        source: edge.source,
        target: edge.target,
      })),
    });

    const code = await generateCode({
      functionId: result.id,
      prompt,
      systemPrompt: FLOW_COMPOSER_AGENT_PROMPT,
    });

    await api.flows.update({
      where: { id: flowId },
      payload: {
        type: "endpoint",
        code,
      },
    });
  } catch (error) {
    console.error(error);
    return {
      status: "error",
      message: "Failed to compile flow",
    };
  }
}
