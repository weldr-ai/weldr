import { db, eq } from "@weldr/db";
import { versions } from "@weldr/db/schema";
import { Fly } from "@weldr/shared/fly";
import { Logger } from "@weldr/shared/logger";
import { machineLookupStore } from "@weldr/shared/machine-lookup-store";

import { runCommand } from "@/lib/commands";
import { SCRIPTS_DIR } from "@/lib/constants";
import { Git } from "@/lib/git";
import { stream } from "@/lib/stream-utils";
import { createStep } from "../engine";

export const deployStep = createStep({
  id: "deploy",
  execute: async ({ context }) => {
    const project = context.get("project");
    const branch = context.get("branch");

    const logger = Logger.get({
      projectId: project.id,
      versionId: branch.headVersion.id,
    });

    try {
      const workspaceDir = Git.getBranchWorkspaceDir(branch.id, branch.isMain);

      // Start the build process asynchronously
      const { stderr, exitCode, success } = await runCommand(
        "bash",
        [
          `${SCRIPTS_DIR}/build.sh`,
          `app-build-${branch.headVersion.id}`,
          process.env.FLY_PREVIEW_DEPLOY_TOKEN || "",
          workspaceDir,
        ],
        {
          timeout: 1000 * 60 * 5, // 5 minutes
        },
      );

      if (exitCode !== 0 || !success) {
        console.error(
          `[deploy:${project.id}] Failed to build preview image: ${
            stderr || "Unknown error"
          }`,
        );
        throw new Error(
          `[deploy:${project.id}] Failed to build preview image: ${
            stderr || "Unknown error"
          }`,
        );
      }

      logger.info("Build completed successfully");

      // Create a machine and register it in the redis store
      const previewMachineId = await Fly.machine.create({
        projectId: project.id,
        type: "preview",
        config: {
          image: `registry.fly.io/weldr-images:app-build-${branch.headVersion.id}`,
          ...Fly.machine.presets.preview,
        },
      });

      if (!previewMachineId) {
        throw new Error(
          `[deploy:${project.id}] Failed to create preview machine`,
        );
      }

      await machineLookupStore.set(
        `preview:${branch.headVersion.id}`,
        `${previewMachineId}:${project.id}`,
      );

      logger.info("Deployment completed successfully");

      await db
        .update(versions)
        .set({ status: "completed" })
        .where(eq(versions.id, branch.headVersion.id));

      // Send SSE notification of completion
      await stream(branch.headVersion.chatId, {
        type: "update_project",
        data: { currentVersion: { status: "completed" } },
      });
    } catch (error) {
      console.error(
        `[deploy:${project.id}] Failed to deploy: ${
          JSON.stringify(error, null, 2) || "Unknown error"
        }`,
      );
      throw new Error(
        `[deploy:${project.id}] Failed to deploy: ${
          JSON.stringify(error, null, 2) || "Unknown error"
        }`,
      );
    }
  },
});
