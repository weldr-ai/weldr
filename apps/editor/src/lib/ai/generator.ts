"use server";

import {
  ENDPOINT_DEVELOPER_PROMPT,
  ENDPOINT_REQUIREMENTS_PROMPT,
  FUNC_DEVELOPER_PROMPT,
  FUNC_REQUIREMENTS_AGENT_PROMPT,
  generateEndpointCodeUserPrompt,
  generateFuncCodeUserPrompt,
} from "@/lib/ai/prompts";
import { createOpenAI } from "@ai-sdk/openai";
import { auth } from "@integramind/auth";
import { and, db, eq } from "@integramind/db";
import { conversations, endpoints } from "@integramind/db/schema";
import type {
  AssistantMessageRawContent,
  EndpointRequirementsMessage,
  FuncRequirementsMessage,
} from "@integramind/shared/types";
import { endpointRequirementsMessageSchema } from "@integramind/shared/validators/endpoints";
import { funcRequirementsMessageSchema } from "@integramind/shared/validators/funcs";
import { type CoreMessage, streamObject } from "ai";
import { createStreamableValue } from "ai/rsc";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { api } from "../trpc/server";
import { assistantMessageRawContentToText } from "../utils";
import { generateCode } from "./helpers";

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  compatibility: "strict",
});

export async function generateFunc(funcId: string) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/auth/sign-in");
  }

  console.log(`[generateFunc] Starting for func ${funcId}`);

  const funcData = await api.funcs.byId({
    id: funcId,
  });

  if (!funcData.name || !funcData.conversationId) {
    return {
      status: "error",
      message: "Function name or conversation ID is required",
    };
  }

  const conversation = await db.query.conversations.findFirst({
    where: and(
      eq(conversations.id, funcData.conversationId),
      eq(conversations.userId, session.user.id),
    ),
    with: {
      messages: true,
    },
  });

  if (!conversation) {
    return {
      status: "error",
      message: "Conversation not found",
    };
  }

  const messages = [
    {
      role: "user",
      content: `You are implementing a function called ${funcData.name} and it has ID: ${funcId}.`,
    },
    ...conversation.messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
  ] as CoreMessage[];

  const stream = createStreamableValue<FuncRequirementsMessage>();

  (async () => {
    console.log(`[generateFunc] Streaming response for func ${funcId}`);
    const { partialObjectStream } = streamObject({
      model: openai("gpt-4o-2024-11-20"),
      system: FUNC_REQUIREMENTS_AGENT_PROMPT,
      messages,
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
            conversationId: conversation.id,
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
            conversationId: conversation.id,
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

          if (
            object.message.content.helperFunctionIds &&
            object.message.content.helperFunctionIds.length > 0
          ) {
            await api.dependencies.createBulk({
              dependentType: "function",
              dependentId: funcId,
              dependencyIds: object.message.content.helperFunctionIds,
            });
          }

          const docs = await compileDocs({
            description: assistantMessageRawContentToText(
              object.message.content.description,
            ),
            signature: object.message.content.signature,
            parameters: object.message.content.parameters,
            returns: object.message.content.returns,
            behavior: assistantMessageRawContentToText(
              object.message.content.behavior,
            ),
            errors: object.message.content.errors,
            examples: object.message.content.examples,
          });

          const funcCodeUserPrompt = await generateFuncCodeUserPrompt({
            name: funcData?.name ?? "",
            docs,
            resources: object.message.content.resources,
            helperFunctionIds: object.message.content.helperFunctionIds,
            packages: object.message.content.packages as
              | {
                  name: string;
                  type: "development" | "production";
                  reason: string;
                }[]
              | undefined,
          });

          console.log(
            `[generateFunc] Generated func code prompt: ${funcCodeUserPrompt}`,
          );

          const code = await generateCode({
            prompt: funcCodeUserPrompt,
            systemPrompt: FUNC_DEVELOPER_PROMPT,
          });

          api.funcs.update({
            where: { id: funcId },
            payload: {
              name: object.message.content.name,
              inputSchema,
              outputSchema,
              rawDescription: object.message.content.description,
              behavior: object.message.content.behavior,
              errors: object.message.content.errors,
              docs,
              resources: object.message.content.resources,
              packages: object.message.content.packages,
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
            conversationId: conversation.id,
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

export async function generateEndpoint(endpointId: string) {
  const endpoint = await db.query.endpoints.findFirst({
    where: eq(endpoints.id, endpointId),
  });

  if (!endpoint) {
    return {
      status: "error",
      message: "Endpoint not found",
    };
  }

  const conversation = await db.query.conversations.findFirst({
    where: eq(conversations.id, endpoint.conversationId),
    with: {
      messages: true,
    },
  });

  if (!conversation) {
    return {
      status: "error",
      message: "Conversation not found",
    };
  }

  const messages = conversation.messages.map((message) => ({
    role: message.role,
    content: message.content,
  })) as CoreMessage[];

  const stream = createStreamableValue<EndpointRequirementsMessage>();

  (async () => {
    console.log(
      `[generateEndpoint] Streaming response for endpoint ${endpointId}`,
    );

    const { partialObjectStream } = streamObject({
      model: openai("gpt-4o-2024-11-20"),
      system: ENDPOINT_REQUIREMENTS_PROMPT,
      messages,
      schema: endpointRequirementsMessageSchema,
      onFinish: async ({ usage, object, error }) => {
        console.log(
          `[generateEndpoint] Completed with usage: ${usage.promptTokens} prompt, ${usage.completionTokens} completion, ${usage.totalTokens} total`,
        );
        console.log(
          `[generateEndpoint] Error: ${JSON.stringify(error, null, 2)}`,
        );
        console.log(
          `[generateEndpoint] Object: ${JSON.stringify(object, null, 2)}`,
        );

        if (object?.message?.type === "message") {
          console.log(
            `[generateEndpoint] Adding message to conversation for endpoint ${endpointId}`,
          );
          api.conversations.addMessage({
            role: "assistant",
            content: assistantMessageRawContentToText(object.message.content),
            rawContent: object.message.content,
            conversationId: conversation.id,
          });
        }

        if (object?.message?.type === "end") {
          const description: AssistantMessageRawContent = [
            {
              type: "text",
              value: `Generating the following endpoint: ${object.message.content.openApiSpec.description}`,
            },
          ];

          api.conversations.addMessage({
            role: "assistant",
            content: assistantMessageRawContentToText(description),
            rawContent: description,
            conversationId: conversation.id,
          });

          console.log(
            `[generateEndpoint] Updating endpoint ${endpointId} with OpenAPI specification`,
          );

          if (
            object.message.content.helperFunctionIds &&
            object.message.content.helperFunctionIds.length > 0
          ) {
            await api.dependencies.createBulk({
              dependentType: "endpoint",
              dependentId: endpointId,
              dependencyIds: object.message.content.helperFunctionIds,
            });
          }

          const openApiSpec = {
            ...object.message.content.openApiSpec,
            parameters: object.message.content.openApiSpec.parameters?.map(
              (parameter) => ({
                ...parameter,
                schema:
                  typeof parameter.schema === "string"
                    ? JSON.parse(parameter.schema)
                    : parameter.schema,
              }),
            ),
            requestBody: object.message.content.openApiSpec.requestBody?.content
              ? {
                  ...object.message.content.openApiSpec.requestBody,
                  content: Object.fromEntries(
                    Object.entries(
                      object.message.content.openApiSpec.requestBody.content,
                    ).map(([key, value]) => [
                      key,
                      {
                        ...(value || {}),
                        schema:
                          typeof value?.schema === "string"
                            ? JSON.parse(value.schema)
                            : value?.schema,
                      },
                    ]),
                  ),
                }
              : undefined,
            responses: Object.fromEntries(
              Object.entries(object.message.content.openApiSpec.responses).map(
                ([key, value]) => [
                  key,
                  {
                    description: value.description || "No description provided",
                    content: Object.fromEntries(
                      Object.entries(value.content || {}).map(
                        ([key, value]) => [
                          key,
                          {
                            schema: JSON.parse(value.schema),
                            example: value.example,
                          },
                        ],
                      ),
                    ),
                  },
                ],
              ),
            ),
          };

          const generatedEndpointCodeUserPrompt =
            await generateEndpointCodeUserPrompt({
              openApiSpec,
              resources: object.message.content.resources,
              helperFunctionIds: object.message.content.helperFunctionIds,
              packages: object.message.content.packages,
            });

          console.log(
            `[generateEndpoint] Generated endpoint code prompt: ${generatedEndpointCodeUserPrompt}`,
          );

          const code = await generateCode({
            prompt: generatedEndpointCodeUserPrompt,
            systemPrompt: ENDPOINT_DEVELOPER_PROMPT,
          });

          api.endpoints.update({
            where: { id: endpointId },
            payload: {
              ...object.message.content.openApiSpec,
              openApiSpec,
              code,
              resources: object.message.content.resources,
              packages: object.message.content.packages,
            },
          });

          api.conversations.addMessage({
            role: "assistant",
            content: "Your endpoint has been built successfully!",
            rawContent: [
              {
                type: "text",
                value: "Your endpoint has been built successfully!",
              },
            ],
            conversationId: conversation.id,
          });
        }
      },
    });

    for await (const partialObject of partialObjectStream) {
      stream.update(partialObject as EndpointRequirementsMessage);
    }

    console.log(
      `[generateEndpoint] Stream completed for endpoint ${endpointId}`,
    );
    stream.done();
  })();
}

async function compileDocs({
  description,
  signature,
  parameters,
  returns,
  behavior,
  errors,
  examples,
}: {
  description: string;
  signature: string;
  parameters: string;
  returns: string;
  behavior: string;
  errors: string | undefined;
  examples: string;
}) {
  const convertMarkdownListToDocBlock = (markdownList: string) => {
    return `* ${markdownList
      .replace(/^-\s+`([^`]+)`:\s+(.+)$/gm, "@throws {Error} $2")
      .replace(/^-\s+(.+)$/gm, "@throws {Error} $1")
      .split("\n")
      .join("\n* ")}`;
  };

  return `${description}

**Signature:**
${signature}

**Parameters:**
${parameters}

**Returns:**
${returns}

**Behavior:**
${behavior}${errors ? `\n\n**Errors:**\n${convertMarkdownListToDocBlock(errors)}` : ""}

**Examples:**
${examples}`;
}
