import type { TStreamableValue } from "@/types";
import type { Tx } from "@weldr/db";
import { and, eq } from "@weldr/db";
import { versions } from "@weldr/db/schema";
import { type CoreMessage, tool } from "ai";
import type { createStreamableValue } from "ai/rsc";
import { z } from "zod";
import { coder } from "../agents/coder";
import { insertMessages } from "../insert-messages";

export const implementTool = tool({
  description:
    "Ask the coder agent to implement the changes to the project. MUST REPLY WITH A FRIENDLY MESSAGE TO THE USER WHILE INVOKING.",
  parameters: z.object({
    addons: z
      .enum(["auth"])
      .array()
      .describe("A list of addons to use for the implementation"),
    commitMessage: z
      .string()
      .min(1)
      .describe(
        "A commit message for the changes made to the project. Must be concise and to the point.",
      ),
    requirements: z
      .string()
      .min(1)
      .describe(
        `Descriptive requirements for the changes to be passed to the coder.
        Your requirements and description of the changes must be as detailed as possible.
        As the coder will be using your requirements to generate the code, it's very important that you provide as much details as possible.
        MUST NOT hallucinate or make assumptions about the changes requested by the user.
        MUST NOT add anything that is not requested by the user.`,
      ),
  }),
});

export async function implement({
  toolArgs,
  stream,
  tx,
  chatId,
  userId,
  projectId,
  promptMessages,
}: {
  toolArgs: {
    addons: "auth"[];
    commitMessage: string;
    requirements: string;
  };
  stream: ReturnType<typeof createStreamableValue<TStreamableValue>>;
  tx: Tx;
  chatId: string;
  userId: string;
  projectId: string;
  promptMessages: CoreMessage[];
}) {
  const [messageId] = await insertMessages({
    tx,
    input: {
      chatId,
      userId,
      messages: [
        {
          role: "tool",
          rawContent: {
            toolName: "implementTool",
            toolArgs,
            toolResult: {
              status: "pending",
            },
          },
        },
      ],
    },
  });

  if (!messageId) {
    throw new Error("Message ID not found");
  }

  stream.update({
    id: messageId,
    type: "tool",
    toolName: "implementTool",
    toolArgs: toolArgs,
    toolResult: {
      status: "pending",
    },
  });

  const previousVersion = await tx.query.versions.findFirst({
    where: and(
      eq(versions.projectId, projectId),
      eq(versions.userId, userId),
      eq(versions.isCurrent, true),
    ),
    columns: {
      id: true,
      number: true,
    },
  });

  if (!previousVersion) {
    throw new Error("Version not found");
  }

  await tx
    .update(versions)
    .set({
      isCurrent: false,
    })
    .where(and(eq(versions.projectId, projectId), eq(versions.userId, userId)));

  const [version] = await tx
    .insert(versions)
    .values({
      projectId,
      userId,
      number: previousVersion.number + 1,
      isCurrent: true,
      message: toolArgs.commitMessage,
    })
    .returning();

  if (!version) {
    throw new Error("Version not found");
  }

  const machineId = await coder({
    stream,
    tx,
    chatId,
    userId,
    projectId,
    versionId: version.id,
    previousVersionId: previousVersion.id,
    promptMessages: [
      ...promptMessages,
      {
        role: "user",
        content: `Please, implement the following changes: ${toolArgs.requirements}`,
      },
    ],
  });

  stream.update({
    id: messageId,
    type: "tool",
    toolName: "implementTool",
    toolArgs: toolArgs,
    toolResult: {
      status: "success",
    },
  });

  stream.update({
    id: version.id,
    type: "version",
    versionId: version.id,
    versionMessage: toolArgs.commitMessage,
    versionNumber: version.number,
    machineId,
  });

  await insertMessages({
    tx,
    input: {
      chatId,
      userId,
      messages: [
        {
          role: "version",
          rawContent: {
            versionId: version.id,
            versionMessage: toolArgs.commitMessage,
            versionNumber: version.number,
          },
        },
      ],
    },
  });
}
