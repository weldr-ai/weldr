"use server";

import { createOpenAI } from "@ai-sdk/openai";
import type {
  FlowType,
  FunctionRequirementsMessage,
  InputSchema,
  RawDescription,
} from "@specly/shared/types";
import { functionRequirementsMessageSchema } from "@specly/shared/validators/common";
import { type CoreMessage, streamObject, streamText } from "ai";
import { createStreamableValue } from "ai/rsc";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import {
  FUNCTION_REQUIREMENTS_AGENT_PROMPT,
  INPUTS_REQUIREMENTS_AGENT_PROMPT,
  INPUTS_SCHEMA_GENERATION_AGENT_PROMPT,
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

const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
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

export async function gatherInputsRequirements(messages: CoreMessage[]) {
  const result = await streamText({
    model: openai("gpt-4o"),
    system: INPUTS_REQUIREMENTS_AGENT_PROMPT,
    messages,
    onFinish: ({ usage, text }) => {
      console.log(text);
      console.log(
        `[usage]: ${usage.promptTokens} prompt, ${usage.completionTokens} completion, ${usage.totalTokens} total`,
      );
    },
  });
  const stream = createStreamableValue(result.textStream);
  return stream.value;
}

export async function generateInputsSchemas({
  prompt,
}: {
  prompt: string;
}) {
  const completion = await openaiClient.beta.chat.completions.parse({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: INPUTS_SCHEMA_GENERATION_AGENT_PROMPT,
      },
      { role: "user", content: prompt },
    ],
    response_format: zodResponseFormat(
      z.object({
        jsonSchema: z.string().describe("JSON schema"),
        zodSchema: z.string().describe("Zod schema"),
      }),
      "validationSchemas",
    ),
  });

  const message = completion.choices[0]?.message;

  if (message?.parsed) {
    return {
      inputSchema: JSON.parse(message.parsed.jsonSchema) as InputSchema,
      validationSchema: message.parsed.zodSchema,
    };
  }

  return undefined;
}

export async function generateFlowInputsSchemas({
  prompt,
  flowId,
  flowType,
}: {
  prompt: string;
  flowId: string;
  flowType: FlowType;
}) {
  const result = await generateInputsSchemas({ prompt });

  if (!result) {
    return false;
  }

  await api.flows.update({
    where: {
      id: flowId,
    },
    payload: {
      type: flowType,
      inputSchema: result.inputSchema,
      validationSchema: result.validationSchema,
    },
  });

  return true;
}
