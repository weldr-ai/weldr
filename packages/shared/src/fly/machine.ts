import { ofetch } from "ofetch/node";

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
    type: FlyAppType;
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

  export const presets = {
    development: (
      projectId: string,
    ): paths["/apps/{app_name}/machines"]["post"]["requestBody"]["content"]["application/json"]["config"] => ({
      init: {
        exec: ["/sbin/pilot"],
      },
      guest: {
        cpu_kind: "shared",
        cpus: 1,
        memory_mb: 1024,
      },
      env: {
        PROJECT_ID: projectId,
      },
      services: [
        {
          protocol: "tcp",
          internal_port: 8080,
          autostop: "stop",
          autostart: true,
          ports: [
            {
              port: 80,
              handlers: ["http"],
            },
          ],
        },
      ],
      containers: [
        {
          name: "storage",
          image: "docker.io/flyio/app-storage:v0.0.24",
          cmd: ["/usr/local/bin/mount.sh"],
          // @ts-ignore - the config is not typed correctly
          mounts: [
            {
              name: "shared",
              path: "/data",
            },
          ],
          env: {
            S3_REGION: "auto",
            S3_ENDPOINT: "https://fly.storage.tigris.dev",
          },
          secrets: [
            {
              env_var: "BUCKET_NAME",
            },
            {
              env_var: "S3_ACCESS_KEY",
            },
            {
              env_var: "S3_SECRET_KEY",
            },
          ],
          restart: {
            policy: "no",
          },
          healthchecks: [
            {
              http: {
                port: 9567,
                method: "head",
                path: "/metrics",
                scheme: "http",
              },
              failure_threshold: 10,
              success_threshold: 1,
              interval: 10,
              grace_period: 15,
            },
          ],
        },
        {
          name: "user-app",
          image: "registry.fly.io/weldr-images:user-app",
          // @ts-ignore - the config is not typed correctly
          mounts: [
            {
              name: "shared",
              path: "/data",
            },
          ],
          healthchecks: [
            {
              http: {
                port: 9567,
                method: "head",
                path: "/metrics",
                scheme: "http",
              },
              failure_threshold: 10,
              success_threshold: 1,
              interval: 10,
              grace_period: 15,
            },
          ],
        },
        {
          name: "weldr-agent",
          image: "registry.fly.io/weldr-images:weldr-agent",
          // @ts-ignore - the config is not typed correctly
          mounts: [
            {
              name: "shared",
              path: "/data",
            },
          ],
          secrets: [
            {
              env_var: "FLY_PREVIEW_DEPLOY_TOKEN",
            },
            {
              env_var: "FLY_PRODUCTION_DEPLOY_TOKEN",
            },
          ],
          depends_on: [
            {
              name: "storage",
              condition: "healthy",
            },
          ],
          restart: {
            policy: "always",
          },
          healthchecks: [
            {
              name: "agent-health",
              http: {
                port: 8080,
                method: "GET",
                path: "/health",
                scheme: "http",
              },
              failure_threshold: 10,
              success_threshold: 1,
              interval: 10,
              grace_period: 15,
              timeout: 5,
            },
          ],
        },
      ],
      volumes: [
        {
          name: "shared",
          temp_dir: {
            size_mb: 100,
            storage_type: "memory",
          },
        },
      ],
    }),
    preview: {
      guest: {
        cpu_kind: "shared",
        cpus: 1,
        memory_mb: 1024,
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
    production: {
      guest: {
        cpu_kind: "shared",
        cpus: 1,
        memory_mb: 1024,
      },
      services: [
        {
          protocol: "tcp",
          internal_port: 3000,
          autostop: "suspend",
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
