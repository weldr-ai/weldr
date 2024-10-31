"use server";

import { createOpenAI } from "@ai-sdk/openai";
import type {
  FlowInputsSchemaMessage,
  FunctionRequirementsMessage,
  RawDescription,
} from "@specly/shared/types";
import {
  flowInputsSchemaMessageSchema,
  functionRequirementsMessageSchema,
} from "@specly/shared/validators/common";
import { type CoreMessage, streamObject } from "ai";
import { createStreamableValue } from "ai/rsc";
import {
  FLOW_INPUT_SCHEMA_AGENT_PROMPT,
  FUNCTION_REQUIREMENTS_AGENT_PROMPT,
} from "~/lib/ai/prompts";
import { api } from "../trpc/rsc";
import { fromRawDescriptionToText } from "../utils";

// const anthropic = createAnthropic({
//   apiKey: process.env.ANTHROPIC_API_KEY,
// });

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  compatibility: "strict",
});

export async function gatherFunctionRequirements({
  functionId,
  conversationId,
  messages,
}: {
  functionId: string;
  conversationId: string;
  messages: CoreMessage[];
}) {
  const stream = createStreamableValue<FunctionRequirementsMessage>();

  (async () => {
    const { partialObjectStream } = await streamObject({
      model: openai("gpt-4o"),
      system: FUNCTION_REQUIREMENTS_AGENT_PROMPT,
      messages,
      schema: functionRequirementsMessageSchema,
      onFinish: ({ usage, object }) => {
        console.log(
          `[usage]: ${usage.promptTokens} prompt, ${usage.completionTokens} completion, ${usage.totalTokens} total`,
        );

        if (object?.message?.type === "message") {
          api.conversations.addMessage({
            role: "assistant",
            content: fromRawDescriptionToText(object.message.content),
            rawContent: object.message.content,
            conversationId,
          });
        }

        if (object?.message?.type === "end") {
          const description: RawDescription[] = [
            {
              type: "text",
              value: "Generating the following function: ",
            },
            ...object.message.content.description,
          ];

          api.conversations.addMessage({
            role: "assistant",
            content: fromRawDescriptionToText(description),
            rawContent: description,
            conversationId,
          });

          api.primitives.update({
            where: { id: functionId },
            payload: {
              type: "function",
              inputSchema: JSON.parse(object.message.content.inputs),
              outputSchema: JSON.parse(object.message.content.outputs),
              rawDescription: object.message.content.description,
              description: fromRawDescriptionToText(
                object.message.content.description,
              ),
              metadata: {
                resources: object.message.content.resources,
                edgeCases: object.message.content.edgeCases,
                errorHandling: object.message.content.errorHandling,
                logicalSteps: object.message.content.logicalSteps,
                dependencies: object.message.content.dependencies,
              },
            },
          });
        }
      },
    });

    for await (const partialObject of partialObjectStream) {
      stream.update(partialObject as FunctionRequirementsMessage);
    }

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
  const stream = createStreamableValue<FlowInputsSchemaMessage>();

  (async () => {
    const { partialObjectStream } = await streamObject({
      model: openai("gpt-4o"),
      system: FLOW_INPUT_SCHEMA_AGENT_PROMPT,
      messages,
      schema: flowInputsSchemaMessageSchema,
      onFinish: ({ usage, object }) => {
        console.log(object);
        console.log(
          `[usage]: ${usage.promptTokens} prompt, ${usage.completionTokens} completion, ${usage.totalTokens} total`,
        );

        if (object?.message?.type === "message") {
          api.conversations.addMessage({
            role: "assistant",
            content: fromRawDescriptionToText(object.message.content),
            rawContent: object.message.content,
            conversationId,
          });
        }

        if (object?.message?.type === "end") {
          const description: RawDescription[] = [
            {
              type: "text",
              value: "Generating the following inputs schema: ",
            },
            ...object.message.content.description,
          ];

          api.conversations.addMessage({
            role: "assistant",
            content: fromRawDescriptionToText(description),
            rawContent: description,
            conversationId,
          });

          api.flows.update({
            where: { id: flowId },
            payload: {
              type: "endpoint",
              inputSchema: JSON.parse(object.message.content.inputSchema),
              validationSchema: object.message.content.zodSchema,
            },
          });
        }
      },
    });

    for await (const partialObject of partialObjectStream) {
      stream.update(partialObject as FlowInputsSchemaMessage);
    }

    stream.done();
  })();

  return stream.value;
}
