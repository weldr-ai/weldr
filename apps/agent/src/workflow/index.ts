import { db, eq } from "@weldr/db";
import { versions } from "@weldr/db/schema";
import { createStep, createWorkflow } from "./engine";
import { codeStep } from "./steps/code";
import { deployStep } from "./steps/deploy";
import { planStep } from "./steps/plan";

const isDev = process.env.NODE_ENV === "development";

export const workflow = createWorkflow({
  retryConfig: {
    attempts: 3,
    delay: 1000,
  },
})
  .step(planStep)
  .suspend(async ({ context }) => context.get("version").status === "pending")
  .step(codeStep)
  .parallel(isDev ? [] : [deployStep])
  .step(
    createStep({
      id: "complete",
      execute: async ({ context }) => {
        await db
          .update(versions)
          .set({ status: "completed" })
          .where(eq(versions.id, context.get("version").id));

        const streamWriter = global.sseConnections?.get(
          context.get("version").chatId,
        );

        if (streamWriter) {
          await streamWriter.write({
            type: "update_project",
            data: { currentVersion: { status: "completed" } },
          });
        }
      },
    }),
  );
