// FIXME: This must be changed completely to accommodate the new deployment architecture

import { Fly } from "@weldr/shared/fly";
import { redisClient } from "@weldr/shared/redis";

export async function deploy({
  projectId,
  versionId,
  machineId,
}: {
  projectId: string;
  versionId: string;
  machineId: string;
}) {
  try {
    // Start the build process asynchronously
    const { stderr, exitCode, success } = await Fly.machine.command({
      type: "job",
      projectId,
      machineId,
      command: `bash /opt/weldr/scripts/build.sh app-production-${projectId} ${versionId} '${process.env.FLY_API_TOKEN}'`,
      jobId: `build-${projectId}-${versionId}`,
    });

    if (exitCode !== 0 || !success) {
      console.error(
        `[deploy:${projectId}] Failed to build preview image: ${stderr || "Unknown error"}`,
      );
      throw new Error(
        `[deploy:${projectId}] Failed to build preview image: ${stderr || "Unknown error"}`,
      );
    }

    console.log(`[deploy:${projectId}] Build completed successfully`);

    // Create a machine and register it in the redis store
    const previewMachineId = await Fly.machine.create({
      projectId,
      type: "production",
      config: {
        image: `registry.fly.io/app-production-${projectId}:${versionId}`,
        ...Fly.machine.presets.preview,
      },
    });

    if (!previewMachineId) {
      throw new Error(`[deploy:${projectId}] Failed to create preview machine`);
    }

    await redisClient.set(
      versionId,
      `${previewMachineId}:app-production-${projectId}`,
    );

    console.log(`[deploy:${projectId}] Deployment completed successfully`);
  } catch (error) {
    console.error(
      `[deploy:${projectId}] Failed to deploy: ${JSON.stringify(error, null, 2) || "Unknown error"}`,
    );
    throw new Error(
      `[deploy:${projectId}] Failed to deploy: ${JSON.stringify(error, null, 2) || "Unknown error"}`,
    );
  }
}
