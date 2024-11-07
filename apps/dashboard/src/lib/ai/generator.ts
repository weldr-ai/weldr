"use server";

import { createOpenAI } from "@ai-sdk/openai";
import type {
  AssistantMessageRawContent,
  FlowInputSchemaMessage,
  FlowOutputSchemaMessage,
  FunctionRequirementsMessage,
} from "@specly/shared/types";
import {
  flowInputSchemaMessageSchema,
  flowOutputSchemaMessageSchema,
  functionRequirementsMessageSchema,
} from "@specly/shared/validators/common";
import { type CoreMessage, streamObject } from "ai";
import { createStreamableValue } from "ai/rsc";
import {
  FLOW_INPUT_SCHEMA_AGENT_PROMPT,
  FLOW_OUTPUTS_SCHEMA_AGENT_PROMPT,
  FUNCTION_REQUIREMENTS_AGENT_PROMPT,
} from "~/lib/ai/prompts";
import { api } from "../trpc/rsc";
import { rawMessageContentToText } from "../utils";

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
  console.log(
    `[gatherFunctionRequirements] Starting for function ${functionId}`,
  );
  const stream = createStreamableValue<FunctionRequirementsMessage>();

  (async () => {
    console.log("[gatherFunctionRequirements] Streaming response from OpenAI");
    const { partialObjectStream } = await streamObject({
      model: openai("gpt-4o"),
      system: FUNCTION_REQUIREMENTS_AGENT_PROMPT(functionId),
      messages,
      schema: functionRequirementsMessageSchema,
      onFinish: ({ usage, object }) => {
        console.log(
          `[gatherFunctionRequirements] Completed with usage: ${usage.promptTokens} prompt, ${usage.completionTokens} completion, ${usage.totalTokens} total`,
        );

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
          api.primitives.update({
            where: { id: functionId },
            payload: {
              type: "function",
              metadata: {
                inputSchema: JSON.parse(object.message.content.inputSchema),
                outputSchema: JSON.parse(object.message.content.outputSchema),
                rawDescription: object.message.content.description,
                description: rawMessageContentToText(
                  object.message.content.description,
                ),
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
  console.log(`[generateFlowInputsSchemas] Starting for flow ${flowId}`);
  const stream = createStreamableValue<FlowInputSchemaMessage>();

  (async () => {
    console.log(
      "[generateFlowInputsSchemas] Streaming response from OpenAI for input schema",
    );
    const { partialObjectStream } = await streamObject({
      model: openai("gpt-4o"),
      system: FLOW_INPUT_SCHEMA_AGENT_PROMPT(flowId),
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
  conversationId,
  messages,
}: {
  flowId: string;
  conversationId: string;
  messages: CoreMessage[];
}) {
  console.log(`[generateFlowOutputsSchemas] Starting for flow ${flowId}`);
  const stream = createStreamableValue<FlowOutputSchemaMessage>();

  (async () => {
    console.log(
      "[generateFlowOutputsSchemas] Streaming response from OpenAI for output schema",
    );
    const { partialObjectStream } = await streamObject({
      model: openai("gpt-4o"),
      system: FLOW_OUTPUTS_SCHEMA_AGENT_PROMPT(flowId),
      messages,
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
