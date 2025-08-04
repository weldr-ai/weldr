import { ofetch } from "ofetch/node";

import { Logger } from "../logger";
import { machineLookupStore } from "../machine-lookup-store";
import { ofetchConfig } from "../ofetch-config";
import type { FlyAppType } from "./config";
import { flyApiHostname, flyApiKey } from "./config";
import type { components, paths } from "./types";

export namespace Machine {
  export const get = async ({
    type,
    projectId,
    machineId,
  }: {
    type: "production" | "development";
    projectId: string;
    machineId: string;
  }) => {
    try {
      const response = await ofetch<components["schemas"]["Machine"]>(
        `${flyApiHostname}/v1/apps/app-${type}-${projectId}/machines/${machineId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${flyApiKey}`,
          },
          ...ofetchConfig({ tag: `fly:machine:get:${projectId}` }),
        },
      );

      return response;
    } catch (error: unknown) {
      if (
        (error as { response?: { status?: number } })?.response?.status === 404
      ) {
        return null;
      }
      throw error;
    }
  };

  export const getDevMachineId = async ({
    projectId,
  }: {
    projectId: string;
  }) => {
    let machineId = await machineLookupStore.get(`${projectId}:dev-machine-id`);

    if (!machineId) {
      machineId = await create({
        type: "development",
        projectId,
        config: presets.development,
      });

      await machineLookupStore.set(`${projectId}:dev-machine-id`, machineId);

      return machineId;
    }

    const response = await get({
      type: "development",
      projectId,
      machineId,
    });

    if (!response) {
      throw new Error("Machine not found");
    }

    if (response.state !== "started") {
      await start({
        type: "development",
        projectId,
        machineId,
      });
    }

    return response.id;
  };

  export const list = async ({
    type,
    projectId,
  }: {
    type: FlyAppType;
    projectId: string;
  }) => {
    const response = await ofetch<components["schemas"]["Machine"][]>(
      `${flyApiHostname}/v1/apps/app-${type}-${projectId}/machines`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${flyApiKey}`,
        },
        ...ofetchConfig({ tag: `fly:machine:list:${projectId}` }),
      },
    );

    return response;
  };

  export const create = async ({
    type,
    projectId,
    config,
    region = "us",
  }: {
    type: FlyAppType;
    projectId: string;
    config: paths["/apps/{app_name}/machines"]["post"]["requestBody"]["content"]["application/json"]["config"];
    region?: "eu" | "us";
  }) => {
    const euRegions = ["ams", "arn", "mad", "lhr", "cdg", "fra"];
    const usRegions = ["iad", "ewr", "yul", "yyz", "sjc", "lax"];
    const allRegions = [
      "iad",
      "ewr",
      "ams",
      "arn",
      "mad",
      "yul",
      "yyz",
      "lhr",
      "cdg",
      "fra",
      "sjc",
      "lax",
    ];

    const availableRegions =
      region === "eu" ? euRegions : region === "us" ? usRegions : allRegions;

    let lastError: Error | null = null;

    for (const region of availableRegions) {
      try {
        const response = await ofetch<
          paths["/apps/{app_name}/machines"]["post"]["responses"][200]["content"]["application/json"]
        >(`${flyApiHostname}/v1/apps/app-${type}-${projectId}/machines`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${flyApiKey}`,
          },
          body: {
            region,
            config,
          } satisfies components["schemas"]["CreateMachineRequest"],
          ...ofetchConfig({ tag: `fly:machine:create:${projectId}` }),
        });

        if (!response.id) {
          throw new Error("Failed to create machine");
        }

        await waitUntil({
          type,
          projectId,
          machineId: response.id,
          state: "started",
        });

        return response.id;
      } catch (error) {
        console.error("Error creating machine:", {
          error: error instanceof Error ? error.message : String(error),
          projectId,
          type,
        });
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }

    throw (
      lastError || new Error("Failed to create machine: All regions failed")
    );
  };

  export const destroy = async ({
    type,
    projectId,
    machineId,
  }: {
    type: FlyAppType;
    projectId: string;
    machineId: string;
  }) => {
    try {
      await ofetch(
        `${flyApiHostname}/v1/apps/app-${type}-${projectId}/machines/${machineId}?force=true`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${flyApiKey}`,
          },
          ...ofetchConfig({ tag: `fly:machine:destroy:${projectId}` }),
        },
      );
    } catch (error) {
      if (
        (error as { response?: { status?: number } })?.response?.status === 404
      ) {
        return;
      }
      throw error;
    }
  };

  export const waitUntil = async ({
    type,
    projectId,
    machineId,
    state = "started",
  }: {
    type: FlyAppType;
    projectId: string;
    machineId: string;
    state?: "started" | "stopped" | "suspended" | "destroyed";
  }) => {
    await ofetch(
      `${flyApiHostname}/v1/apps/app-${type}-${projectId}/machines/${machineId}/wait?state=${state}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${flyApiKey}`,
        },
        ...ofetchConfig({ tag: `fly:machine:waitUntil:${projectId}` }),
      },
    );
  };

  export const start = async ({
    type,
    projectId,
    machineId,
  }: {
    type: FlyAppType;
    projectId: string;
    machineId: string;
  }) => {
    await ofetch(
      `${flyApiHostname}/v1/apps/app-${type}-${projectId}/machines/${machineId}/start`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${flyApiKey}`,
        },
        ...ofetchConfig({ tag: `fly:machine:start:${projectId}` }),
      },
    );
  };

  const asyncExecute = async ({
    projectId,
    machineId,
    command,
    jobId,
  }: {
    type?: FlyAppType;
    projectId: string;
    machineId: string;
    command: string;
    jobId: string;
  }): Promise<{ jobId: string }> => {
    try {
      // Construct URL based on environment
      let url: string;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (process.env.NODE_ENV === "production") {
        // Production: use internal network
        url = `http://${machineId}.vm.app-development-${projectId}.internal/jobs`;
      } else {
        // Development: use external URL with shared secret
        url = `https://${machineId}-${projectId}.internal.weldr.app/jobs`;
        headers["X-Weldr-Reverse-Proxy-Secret"] =
          process.env.REVERSE_PROXY_SECRET || "";
      }

      // Make request to Hono server on the machine
      const response = await ofetch<{
        jobId: string;
        status: string;
        message: string;
      }>(url, {
        method: "POST",
        headers,
        body: {
          command,
          jobId,
        },
        ...ofetchConfig({
          tag: `fly:machine:execute-command-async:${projectId}`,
        }),
        onResponseError: async (context) => {
          if (context.response.status === 412) {
            Logger.info("Machine is not started, starting it", {
              projectId,
              machineId,
            });
            await start({
              type: "development",
              projectId,
              machineId,
            });
          }
        },
      });

      return { jobId: response.jobId };
    } catch (error) {
      throw new Error(`Failed to start async command: ${error}`);
    }
  };

  export const executeCommand = async ({
    projectId,
    machineId,
    command,
  }: {
    projectId: string;
    machineId: string;
    command: string;
  }): Promise<{
    stdout: string | null;
    stderr: string | null;
    success: boolean;
    exitCode: number | null;
  }> => {
    try {
      // Construct URL based on environment
      let url: string;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (process.env.NODE_ENV === "production") {
        // Production: use internal network
        url = `http://${machineId}.vm.app-development-${projectId}.internal/execute`;
      } else {
        // Development: use external URL with shared secret
        url = `https://${machineId}-${projectId}.internal.weldr.app/execute`;
        headers["X-Weldr-Reverse-Proxy-Secret"] =
          process.env.REVERSE_PROXY_SECRET || "";
      }

      // Make request to Hono server on the machine
      const response = await ofetch<{
        stdout: string | null;
        stderr: string | null;
        success: boolean;
        exitCode: number | null;
      }>(url, {
        method: "POST",
        headers,
        body: {
          command,
        },
        ...ofetchConfig({
          tag: `fly:machine:execute-command:${projectId}`,
        }),
        onResponseError: async (context) => {
          if (context.response.status === 412) {
            Logger.info("Machine is not started, starting it", {
              projectId,
              machineId,
            });
            await start({
              type: "development",
              projectId,
              machineId,
            });
          }
        },
      });

      return {
        stdout: response.stdout,
        stderr: response.stderr,
        success: response.success,
        exitCode: response.exitCode,
      };
    } catch (error) {
      throw new Error(`Failed to execute command: ${error}`);
    }
  };

  const pollCommandStatus = async ({
    projectId,
    machineId,
    jobId,
  }: {
    projectId: string;
    machineId: string;
    jobId: string;
  }): Promise<{
    status: "queued" | "processing" | "completed" | "failed";
    stdout: string | null;
    stderr: string | null;
    exitCode: number | null;
    success: boolean;
  }> => {
    try {
      // In production, poll from Redis directly
      if (process.env.NODE_ENV === "production") {
        const redisStatus = await machineLookupStore.get(`job:${jobId}`);
        if (redisStatus) {
          const parsed = JSON.parse(redisStatus);
          return {
            status: parsed.status,
            stdout: parsed.result?.stdout || parsed.error?.stdout,
            stderr: parsed.result?.stderr || parsed.error?.stderr,
            exitCode: parsed.result?.exitCode || parsed.error?.exitCode,
            success: parsed.result?.success || parsed.error?.success,
          };
        }
        throw new Error(`Job ${jobId} not found in Redis`);
      }

      // In development, poll from the machine endpoint
      const url = `https://${machineId}-${projectId}.internal.weldr.app/jobs/${jobId}`;
      const headers: Record<string, string> = {
        "X-Weldr-Reverse-Proxy-Secret": process.env.REVERSE_PROXY_SECRET || "",
      };

      const response = await ofetch<{
        jobId: string;
        status: "queued" | "processing" | "completed" | "failed";
        result?: {
          stdout: string | null;
          stderr: string | null;
          exitCode: number | null;
          success: boolean;
        };
        error?: {
          stdout: string | null;
          stderr: string | null;
          exitCode: number | null;
          success: boolean;
        };
      }>(url, {
        method: "GET",
        headers,
        ...ofetchConfig({
          tag: `fly:machine:poll-command-status:${projectId}`,
        }),
        onResponseError: async (context) => {
          if (
            process.env.NODE_ENV !== "production" &&
            context.response.status === 412
          ) {
            Logger.info("Machine is not started, starting it", {
              projectId,
              machineId,
            });
            await start({
              type: "development",
              projectId,
              machineId,
            });
          }
        },
      });

      return {
        status: response.status,
        stdout: response.result?.stdout || response.error?.stdout || null,
        stderr: response.result?.stderr || response.error?.stderr || null,
        exitCode: response.result?.exitCode || response.error?.exitCode || null,
        success: response.result?.success || response.error?.success || false,
      };
    } catch (error) {
      throw new Error(
        `Failed to poll command status: ${JSON.stringify(error, null, 2)}`,
      );
    }
  };

  const waitForCommand = async ({
    projectId,
    machineId,
    jobId,
    maxWaitTime = 300000, // 5 minutes default
    pollInterval = 1000, // 1 second
  }: {
    projectId: string;
    machineId: string;
    jobId: string;
    maxWaitTime?: number;
    pollInterval?: number;
  }): Promise<{
    stdout: string | null;
    stderr: string | null;
    exitCode: number | null;
    success: boolean;
  }> => {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      const status = await pollCommandStatus({
        projectId,
        machineId,
        jobId,
      });

      if (status.status === "completed") {
        return {
          stdout: status.stdout,
          stderr: status.stderr,
          exitCode: status.exitCode,
          success: status.success,
        };
      }

      if (status.status === "failed") {
        throw new Error(`Command failed: ${status.stderr || "Unknown error"}`);
      }

      // Continue polling if status is "queued" or "processing"
      if (status.status === "queued" || status.status === "processing") {
        // Wait before polling again
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
        continue;
      }

      // If we get here, something unexpected happened
      throw new Error(`Unexpected job status: ${status.status}`);
    }

    throw new Error(`Command timed out after ${maxWaitTime}ms`);
  };

  type CommandOptions =
    | {
        type: "job";
        projectId: string;
        machineId: string;
        command: string;
        jobId: string;
        maxWaitTime?: number;
        pollInterval?: number;
      }
    | {
        type: "command";
        projectId: string;
        machineId: string;
        command: string;
      };

  export const command = async (options: CommandOptions) => {
    if (options.type === "job") {
      const { jobId: jobIdAsync } = await asyncExecute({
        projectId: options.projectId,
        machineId: options.machineId,
        command: options.command,
        jobId: options.jobId,
      });

      const { stdout, stderr, exitCode, success } = await waitForCommand({
        projectId: options.projectId,
        machineId: options.machineId,
        jobId: jobIdAsync,
        maxWaitTime: options.maxWaitTime,
        pollInterval: options.pollInterval,
      });

      return { stdout, stderr, exitCode, success };
    }

    return await executeCommand({
      projectId: options.projectId,
      machineId: options.machineId,
      command: options.command,
    });
  };

  export const presets = {
    development: {
      image: "registry.fly.io/weldr-images:dev-machine",
      guest: {
        cpu_kind: "shared",
        cpus: 2,
        memory_mb: 2048,
      },
      services: [
        {
          protocol: "tcp",
          internal_port: 3000,
          autostop: "stop",
          autostart: true,
          ports: [
            {
              port: 443,
              handlers: ["tls", "http"],
            },
            {
              port: 80,
              handlers: ["http"],
            },
          ],
        },
      ],
    } satisfies paths["/apps/{app_name}/machines"]["post"]["requestBody"]["content"]["application/json"]["config"],
    preview: {
      guest: {
        cpu_kind: "shared",
        cpus: 1,
        memory_mb: 512,
      },
      services: [
        {
          protocol: "tcp",
          internal_port: 3000,
          autostop: "stop",
          autostart: true,
          ports: [
            {
              port: 443,
              handlers: ["tls", "http"],
            },
            {
              port: 80,
              handlers: ["http"],
            },
          ],
        },
      ],
    } satisfies paths["/apps/{app_name}/machines"]["post"]["requestBody"]["content"]["application/json"]["config"],
  };
}
