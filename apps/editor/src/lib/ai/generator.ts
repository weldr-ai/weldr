"use server";

import {
  FUNC_DEVELOPER_PROMPT,
  FUNC_REQUIREMENTS_AGENT_PROMPT,
  getGenerateFuncCodePrompt,
} from "@/lib/ai/prompts";
import { createOpenAI } from "@ai-sdk/openai";
import { auth } from "@integramind/auth";
import { and, db, eq } from "@integramind/db";
import { conversations } from "@integramind/db/schema";
import type {
  AssistantMessageRawContent,
  FuncRequirementsMessage,
} from "@integramind/shared/types";
import { funcRequirementsMessageSchema } from "@integramind/shared/validators/common";
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

export async function generateFunc({
  funcId,
  conversationId,
}: {
  funcId: string;
  conversationId: string;
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

  const conversation = await db.query.conversations.findFirst({
    where: and(
      eq(conversations.id, conversationId),
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
      content: `You are implementing a function called ${funcData?.name} and it has ID: ${funcId}.`,
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

          const generatedFuncCodePrompt = await getGenerateFuncCodePrompt({
            currentModuleId: funcData.moduleId,
            name: funcData?.name ?? "",
            docs,
            resources: object.message.content.resources,
            helperFunctionIds: object.message.content.helperFunctionIds,
            npmDependencies: object.message.content.npmDependencies as
              | {
                  name: string;
                  type: "development" | "production";
                  reason: string;
                }[]
              | undefined,
          });

          console.log(
            `[generateFunc] Generated func code prompt: ${generatedFuncCodePrompt}`,
          );

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
              behavior: object.message.content.behavior,
              errors: object.message.content.errors,
              docs,
              resources: object.message.content.resources,
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
