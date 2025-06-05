import { takeScreenshot } from "@/lib/take-screenshot";
import type { TStreamableValue } from "@/types";
import { and, db, eq } from "@weldr/db";
import { projects, versions } from "@weldr/db/schema";
import { type CoreMessage, tool } from "ai";
import { z } from "zod";
import { coder } from "../agents/coder";
import { deploy } from "../agents/coder/deploy";
import { enrich } from "../agents/coder/enrich";

export const coderTool = tool({
  description:
    "Ask the coder agent to implement the request. MUST BE CALLED AFTER THE USER HAS PROVIDED THE REQUIREMENTS.",
  parameters: z.object({
    name: z
      .string()
      .nullable()
      .optional()
      .describe("The name of the project if it's a new project."),
    commitMessage: z
      .string()
      .min(1)
      .describe(
        "A commit message for the changes made to the project. Must be concise and to the point.",
      ),
    description: z
      .string()
      .min(1)
      .describe(
        `Detailed description of the changes to be passed to the coder.
      Your description of the changes must be as detailed as possible.
      As the coder will be using your description to generate the code, it's very important that you provide as much details as possible.
      MUST NOT hallucinate or make assumptions about the changes requested by the user.
      MUST NOT add anything that is not requested by the user.`,
      ),
  }),
});

export const executeCoderTool = async ({
  userId,
  projectId,
  version,
  promptMessages,
  streamWriter,
  machineId,
  toolArgs,
}: {
  userId: string;
  projectId: string;
  version: typeof versions.$inferSelect;
  machineId: string;
  promptMessages: CoreMessage[];
  streamWriter: WritableStreamDefaultWriter<TStreamableValue>;
  toolArgs?: z.infer<typeof coderTool.parameters>;
}) => {
  let versionStatus = version.progress;

  console.log(
    `[coderTool:${projectId}] Implementing project with status ${versionStatus}`,
  );

  if (versionStatus === "initiated") {
    console.log(`[coderTool:${projectId}] Invoking coder`);
    const { name, commitMessage, description } = toolArgs ?? {};

    await db.transaction(async (tx) => {
      if (name) {
        console.log(`[coderTool:${projectId}] Updating project name`);
        await tx
          .update(projects)
          .set({
            name,
          })
          .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
      }

      console.log(
        `[coderTool:${projectId}] Updating version message and description`,
      );
      if (commitMessage || description) {
        await tx
          .update(versions)
          .set({
            message: commitMessage,
            description,
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
      version,
      userId,
      machineId,
      promptMessages,
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
      userId,
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
