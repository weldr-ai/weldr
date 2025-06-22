import { runCommand } from "@/ai/utils/commands";
import { SCRIPTS_DIR } from "@/lib/constants";
import { Logger } from "@/lib/logger";
import type { WorkflowContext } from "@/workflow/context";
import { Fly } from "@weldr/shared/fly";
import { redisClient } from "@weldr/shared/redis";
import { createStep } from "../engine";

const isDev = process.env.NODE_ENV === "development";

export const deployStep = createStep<WorkflowContext>({
  id: "deploy",
  execute: async ({ context }) => {
    const project = context.get("project");
    const version = context.get("version");

    // Create contextual logger with base tags and extras
    const logger = Logger.get({
      tags: ["deploy"],
      extra: {
        projectId: project.id,
        versionId: version.id,
      },
    });

    if (isDev) {
      return;
    }

    try {
      // Start the build process asynchronously
      const { stderr, exitCode, success } = await runCommand(
        "bash",
        [
          `${SCRIPTS_DIR}/build.sh`,
          `app-production-${project.id}`,
          version.id,
          process.env.FLY_API_TOKEN || "",
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
        type: "production",
        config: {
          image: `registry.fly.io/app-production-${project.id}:${version.id}`,
          ...Fly.machine.presets.preview,
        },
      });

      if (!previewMachineId) {
        throw new Error(
          `[deploy:${project.id}] Failed to create preview machine`,
        );
      }

      await redisClient.set(
        version.id,
        `${previewMachineId}:app-production-${project.id}`,
      );

      logger.info("Deployment completed successfully");
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
