"use server";

import {
  ENDPOINT_DEVELOPER_PROMPT,
  ENDPOINT_REQUIREMENTS_PROMPT,
  FUNC_DEVELOPER_PROMPT,
  FUNC_REQUIREMENTS_AGENT_PROMPT,
  generateEndpointCodeUserPrompt,
  generateFuncCodeUserPrompt,
} from "@/lib/ai/legacy-prompts";
import { createOpenAI } from "@ai-sdk/openai";
import { auth } from "@weldr/auth";
import { and, db, eq, isNotNull, not } from "@weldr/db";
import { chats, endpoints, funcs } from "@weldr/db/schema";
import type {
  EndpointRequirementsMessage,
  FuncRequirementsMessage,
} from "@weldr/shared/types";
import { assistantMessageRawContentToText } from "@weldr/shared/utils";
import { endpointRequirementsMessageSchema } from "@weldr/shared/validators/endpoints";
import { funcRequirementsMessageSchema } from "@weldr/shared/validators/funcs";
import { type CoreMessage, streamObject } from "ai";
import { createStreamableValue } from "ai/rsc";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { api } from "../trpc/server";
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

  const funcData = await db.query.funcs.findFirst({
    where: and(eq(funcs.id, funcId), eq(funcs.userId, session.user.id)),
  });

  const projectId = funcData?.projectId;

  if (!funcData || !projectId) {
    return {
      status: "error",
      message: "Function not found",
    };
  }

  if (!funcData.chatId) {
    return {
      status: "error",
      message: "Function name or chat ID is required",
    };
  }

  const existingFuncs = await db.query.funcs.findMany({
    where: and(
      eq(funcs.projectId, projectId),
      eq(funcs.userId, session.user.id),
      not(eq(funcs.id, funcId)),
      isNotNull(funcs.currentDefinitionId),
    ),
    with: {
      currentDefinition: true,
    },
  });

  const chat = await db.query.chats.findFirst({
    where: and(
      eq(chats.id, funcData.chatId),
      eq(chats.userId, session.user.id),
    ),
    with: {
      messages: {
        orderBy: (messages, { asc }) => [asc(messages.createdAt)],
      },
    },
  });

  if (!chat) {
    return {
      status: "error",
      message: "Chat not found",
    };
  }

  console.log(`[generateFunc] Chat: ${JSON.stringify(chat, null, 2)}`);

  console.log(
    `[generateFunc] Existing funcs: ${JSON.stringify(existingFuncs, null, 2)}`,
  );

  const messages = [
    {
      role: "user",
      content: `The function you are generating should not have the same name as any of the following functions:
      ${
        existingFuncs.length > 0
          ? existingFuncs
              .filter((existingFunc) => existingFunc.currentDefinition !== null)
              .map(
                (existingFunc) =>
                  `- \`${existingFunc.currentDefinition?.name}\``,
              )
              .join("\n")
          : "No other functions implemented yet"
      }`,
    },
    ...chat.messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
  ] as CoreMessage[];

  console.log(`[generateFunc] Messages: ${JSON.stringify(messages, null, 2)}`);

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
            `[generateFunc] Adding message to chat for func ${funcId}`,
          );
          await api.chats.addMessage({
            chatId: chat.id,
            messages: [
              {
                role: "assistant",
                rawContent: object.message.content,
              },
            ],
          });
        }

        if (object?.message?.type === "end") {
          console.log("[generateFunc] Processing final requirements");
          console.log(
            `[generateFunc] Updating func ${funcId} with gathered requirements`,
          );

          const inputSchema = object.message.content.inputSchema
            ? JSON.parse(object.message.content.inputSchema)
            : undefined;

          const outputSchema = object.message.content.outputSchema
            ? JSON.parse(object.message.content.outputSchema)
            : undefined;

          const helperFunctionIds = object.message.content.helperFunctionIds;

          const docs = compileDocs({
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
            name: object.message.content.name ?? "",
            docs,
            resources: object.message.content.resources,
            helperFunctionIds,
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

          console.log(`[generateFunc] Generated code: ${code}`);

          await api.funcs.define({
            where: { id: funcId },
            payload: {
              name: object.message.content.name,
              rawDescription: object.message.content.description,
              behavior: object.message.content.behavior,
              errors: object.message.content.errors,
              inputSchema,
              outputSchema,
              docs,
              code,
              resources: object.message.content.resources,
              packages: object.message.content.packages,
              helperFunctionIds: object.message.content.helperFunctionIds,
            },
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
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/auth/sign-in");
  }

  const endpoint = await db.query.endpoints.findFirst({
    where: and(
      eq(endpoints.id, endpointId),
      eq(endpoints.userId, session.user.id),
    ),
  });

  const projectId = endpoint?.projectId;

  if (!endpoint || !projectId) {
    return {
      status: "error",
      message: "Endpoint not found",
    };
  }

  const existingEndpoints = await db.query.endpoints.findMany({
    where: and(
      eq(endpoints.projectId, projectId),
      eq(endpoints.userId, session.user.id),
      not(eq(endpoints.id, endpointId)),
      isNotNull(endpoints.currentDefinitionId),
    ),
    with: {
      currentDefinition: true,
    },
  });

  const chat = await db.query.chats.findFirst({
    where: eq(chats.id, endpoint.chatId),
    with: {
      messages: true,
    },
  });

  if (!chat) {
    return {
      status: "error",
      message: "Chat not found",
    };
  }

  const messages = [
    {
      role: "user",
      content: `The application has the following endpoints implemented:
      ${
        existingEndpoints.length > 0
          ? existingEndpoints
              .map(
                (existingEndpoint) =>
                  `- ${existingEndpoint.currentDefinition?.method} ${existingEndpoint.currentDefinition?.path}`,
              )
              .join("\n")
          : "No other endpoints implemented yet"
      }`,
    },
    ...chat.messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
  ] as CoreMessage[];

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
            `[generateEndpoint] Adding message to chat for endpoint ${endpointId}`,
          );
          await api.chats.addMessage({
            chatId: chat.id,
            messages: [
              {
                role: "assistant",
                rawContent: object.message.content,
              },
            ],
          });
        }

        if (object?.message?.type === "end") {
          console.log(
            `[generateEndpoint] Updating endpoint ${endpointId} with OpenAPI specification`,
          );

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

          await api.endpoints.define({
            where: { id: endpointId },
            payload: {
              openApiSpec,
              code,
              packages: object.message.content.packages,
              resources: object.message.content.resources,
              helperFunctionIds: object.message.content.helperFunctionIds,
            },
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

  return stream.value;
}

function compileDocs({
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
}): string {
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
