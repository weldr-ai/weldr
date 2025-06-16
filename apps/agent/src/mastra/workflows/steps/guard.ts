import type { AgentRuntimeContext } from "@/mastra";
import { createStep } from "@mastra/core";
import type { RuntimeContext } from "@mastra/core/runtime-context";
import { db, eq } from "@weldr/db";
import { versions } from "@weldr/db/schema";
import { z } from "zod";

const guardStepInputSchema = z.object({
  messages: z.array(z.any()),
});

export const guardStep = createStep({
  id: "guard-step",
  description: "Guard the workflow",
  inputSchema: guardStepInputSchema,
  outputSchema: z.object({
    commitMessage: z.string(),
    description: z.string(),
    messages: z.array(z.any()),
  }),
  execute: async ({
    inputData,
    runtimeContext,
    suspend,
  }: {
    inputData: z.infer<typeof guardStepInputSchema>;
    runtimeContext: RuntimeContext<AgentRuntimeContext>;
    // biome-ignore lint/complexity/noBannedTypes: <explanation>
    suspend: (input: {}) => Promise<void>;
  }) => {
    const version = runtimeContext.get("version");

    const updatedVersion = await db.query.versions.findFirst({
      where: eq(versions.id, version.id),
    });

    if (!updatedVersion) {
      throw new Error("Version not found");
    }

    const { progress, message, description } = updatedVersion;

    if (!progress || !message || !description) {
      await suspend({});
    }

    return {
      commitMessage: message as string,
      description: description as string,
      messages: inputData.messages,
    };
  },
});
