import { SCRIPTS_DIR } from "@/lib/constants";
import { execute } from "@/lib/exec";
import type { AgentRuntimeContext } from "@/mastra";
import { createStep } from "@mastra/core";
import type { RuntimeContext } from "@mastra/core/runtime-context";
import { Fly } from "@weldr/shared/fly";
import { redisClient } from "@weldr/shared/redis";
import { z } from "zod";

const isDev = process.env.NODE_ENV === "development";

export const deployStep = createStep({
  id: "deploy-step",
  description: "Deploy the version",
  inputSchema: z.void(),
  outputSchema: z.void(),
  execute: async ({
    runtimeContext,
  }: {
    runtimeContext: RuntimeContext<AgentRuntimeContext>;
  }) => {
    if (isDev) {
      return;
    }

    const project = runtimeContext.get("project");
    const version = runtimeContext.get("version");

    try {
      // Start the build process asynchronously
      const { stderr, exitCode, success } = await execute(
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
          `[deploy:${project.id}] Failed to build preview image: ${stderr || "Unknown error"}`,
        );
        throw new Error(
          `[deploy:${project.id}] Failed to build preview image: ${stderr || "Unknown error"}`,
        );
      }

      console.log(`[deploy:${project.id}] Build completed successfully`);

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

      console.log(`[deploy:${project.id}] Deployment completed successfully`);
    } catch (error) {
      console.error(
        `[deploy:${project.id}] Failed to deploy: ${JSON.stringify(error, null, 2) || "Unknown error"}`,
      );
      throw new Error(
        `[deploy:${project.id}] Failed to deploy: ${JSON.stringify(error, null, 2) || "Unknown error"}`,
      );
    }
  },
});
