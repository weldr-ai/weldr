"use server";

import { createOpenAI } from "@ai-sdk/openai";
import type { InputSchema } from "@specly/shared/types";
import { rawDescriptionSchema } from "@specly/shared/validators/common";
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

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  compatibility: "strict",
});

const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const functionRequirementsMessageSchema = z.object({
  message: z.discriminatedUnion("type", [
    z
      .object({
        type: z.literal("message"),
        content: rawDescriptionSchema
          .array()
          .describe(
            "The content of the message as a list of text and reference parts",
          ),
      })
      .describe("Message of the function requirements gathering"),
    z
      .object({
        type: z.literal("end"),
        content: z.object({
          inputs: z
            .string()
            .describe("JSON schema for the inputs of the function"),
          outputs: z
            .string()
            .describe("JSON schema for the outputs of the function"),
          description: rawDescriptionSchema
            .array()
            .describe(
              "The description of the function as a list of text and reference parts similar to messages. You should never use text only. You must mention all references using the schema provided.",
            ),
          resources: z
            .string()
            .array()
            .describe("The IDs for all the used resources"),
          logicalSteps: z.string().describe("Logical steps for the function"),
          edgeCases: z.string().describe("Edge cases for the function"),
          errorHandling: z
            .string()
            .describe(
              "Error handling for the function. Assume that inputs are always valid.",
            ),
        }),
      })
      .describe("Last message of the function requirements gathering"),
  ]),
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
  const stream =
    createStreamableValue<z.infer<typeof functionRequirementsMessageSchema>>();

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
            conversationId,
            rawContent: object.message.content,
            content: fromRawDescriptionToText(object.message.content),
          });
        }

        if (object?.message?.type === "end") {
          api.conversations.addMessage({
            conversationId,
            rawContent: object.message.content.description,
            content: fromRawDescriptionToText(
              object.message.content.description,
            ),
            role: "assistant",
          });

          api.primitives.update({
            where: { id: functionId },
            payload: {
              type: "function",
              metadata: {
                inputSchema: JSON.parse(object.message.content.inputs),
                outputSchema: JSON.parse(object.message.content.outputs),
                rawDescription: object.message.content.description,
                resources: object.message.content.resources,
                edgeCases: object.message.content.edgeCases,
                errorHandling: object.message.content.errorHandling,
                logicalSteps: object.message.content.logicalSteps,
              },
            },
          });
        }
      },
    });

    for await (const partialObject of partialObjectStream) {
      stream.update(
        partialObject as z.infer<typeof functionRequirementsMessageSchema>,
      );
    }

    stream.done();
  })();

  return stream.value;
}

export async function gatherInputsRequirements(messages: CoreMessage[]) {
  const result = await streamText({
    model: openai("gpt-4o-mini"),
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
    model: "gpt-4o-mini",
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
  flowType: "task" | "endpoint" | "component";
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
