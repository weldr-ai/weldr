"use server";

import { createOpenAI } from "@ai-sdk/openai";
import type { InputSchema } from "@specly/shared/types";
import { type CoreMessage, streamText } from "ai";
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

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  compatibility: "strict",
});

const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function gatherFunctionRequirements(messages: CoreMessage[]) {
  const result = await streamText({
    model: openai("gpt-4o-mini"),
    system: FUNCTION_REQUIREMENTS_AGENT_PROMPT,
    messages,
    onFinish: ({ usage }) => {
      console.log(
        `[usage]: ${usage.promptTokens} prompt, ${usage.completionTokens} completion, ${usage.totalTokens} total`,
      );
    },
  });
  const stream = createStreamableValue(result.textStream);
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
