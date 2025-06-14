import { takeScreenshot } from "@/lib/take-screenshot";
import type { TStreamableValue } from "@/types";
import type { User } from "@weldr/auth";
import { db, eq } from "@weldr/db";
import { versions } from "@weldr/db/schema";
import { type CoreMessage, tool } from "ai";
import { z } from "zod";
import { coder } from "../agents/coder";
import { deploy } from "../agents/coder/deploy";
import { enrich } from "../agents/coder/enrich";

export const coderTool = tool({
  description: "Ask the coder agent to implement the request.",
  parameters: z.object({
    commitMessage: z
      .string()
      .min(1)
      .describe(
        "A short commit message for the changes made to the project. Must be concise and to the point. Must follow conventional commit message format. Must be in the present tense. Must be in the first person.",
      ),
    description: z
      .string()
      .min(1)
      .describe("Detailed description of the changes"),
  }),
});

export const executeCoderTool = async ({
  projectId,
  projectContext,
  version,
  user,
  machineId,
  promptMessages,
  streamWriter,
  args,
}: {
  projectId: string;
  projectContext: string;
  version: typeof versions.$inferSelect;
  user: User;
  machineId: string;
  promptMessages: CoreMessage[];
  streamWriter: WritableStreamDefaultWriter<TStreamableValue>;
  args: z.infer<typeof coderTool.parameters>;
}) => {
  let versionStatus = version.progress;

  console.log(
    `[coderTool:${projectId}] Implementing project with status ${versionStatus}`,
  );

  if (versionStatus === "initiated") {
    console.log(`[coderTool:${projectId}] Invoking coder`);
    await db.transaction(async (tx) => {
      console.log(
        `[coderTool:${projectId}] Updating version message and description`,
      );
      if (args.commitMessage || args.description) {
        await tx
          .update(versions)
          .set({
            message: args.commitMessage,
            description: args.description,
          })
          .where(eq(versions.id, version.id));
      }
    });

    await streamWriter.write({
      type: "coder",
      status: "initiated",
    });

    await coder({
      streamWriter,
      projectId,
      projectContext,
      version,
      user,
      machineId,
      promptMessages,
      args,
    });

    versionStatus = "coded";
    console.log(`[coderTool:${projectId}] Coder finished`);
    await streamWriter.write({
      type: "coder",
      status: "coded",
    });
  }

  if (versionStatus === "coded") {
    console.log(`[coderTool:${projectId}] Invoking deploy`);
    await deploy({
      projectId,
      versionId: version.id,
      machineId,
    });
    versionStatus = "deployed";
    console.log(`[coderTool:${projectId}] Deploy finished`);
    await streamWriter.write({
      type: "coder",
      status: "deployed",
    });
  }

  if (versionStatus === "deployed") {
    console.log(`[coderTool:${projectId}] Invoking enrichment`);
    await enrich({
      projectId,
      versionId: version.id,
      machineId,
      streamWriter,
      userId: user.id,
    });
    versionStatus = "enriched";
    await streamWriter.write({
      type: "coder",
      status: "enriched",
    });
  }

  if (versionStatus === "enriched") {
    console.log(`[coderTool:${projectId}] Taking screenshot`);
    await takeScreenshot({
      versionId: version.id,
      projectId,
    });
    await db
      .update(versions)
      .set({
        progress: "succeeded",
      })
      .where(eq(versions.id, version.id));
    versionStatus = "succeeded";
    await streamWriter.write({
      type: "coder",
      status: "succeeded",
    });
  }
};
