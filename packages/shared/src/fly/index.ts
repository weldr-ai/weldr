import "server-only";

import { ofetch } from "ofetch/node";
import type { components, paths } from "./types";

const flyApiHostname = process.env.FLY_API_HOSTNAME;
const flyApiKey = process.env.FLY_API_KEY;
const flyOrgSlug = process.env.FLY_ORG_SLUG;

export const Fly = {
  app: {
    create: async ({
      appName,
      networkName,
    }: {
      appName: string;
      networkName: string;
    }) => {
      try {
        const app = await ofetch<{ id: string }>(`${flyApiHostname}/v1/apps`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${flyApiKey}`,
          },
          body: {
            app_name: appName,
            network: networkName,
            org_slug: flyOrgSlug,
          },
        });

        if (!app?.id) {
          throw new Error("Failed to create app: No app ID returned");
        }

        // Allocate private IPv6 address for the app
        const ipAddress = await ofetch<{
          data: {
            allocateIpAddress: {
              ipAddress: {
                address: string;
              };
            };
          };
        }>("https://api.fly.io/graphql", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${flyApiKey}`,
          },
          body: {
            query: `
              mutation($input: AllocateIPAddressInput!) {
                allocateIpAddress(input: $input) {
                  ipAddress {
                    address
                  }
                }
              }
            `,
            variables: {
              input: {
                appId: appName,
                type: "private_v6",
              },
            },
          },
        });

        if (!ipAddress?.data?.allocateIpAddress?.ipAddress?.address) {
          throw new Error("Failed to allocate IP address");
        }

        return {
          ...app,
          ipAddressV6: ipAddress.data.allocateIpAddress.ipAddress.address,
        };
      } catch (error) {
        console.error("Error creating app:", {
          error: error instanceof Error ? error.message : String(error),
          appName,
          networkName,
        });
        throw error;
      }
    },
  },
  machine: {
    get: async ({
      projectId,
      machineId,
    }: {
      projectId: string;
      machineId: string;
    }) => {
      const response = await ofetch<components["schemas"]["Machine"]>(
        `${flyApiHostname}/v1/apps/preview-app-${projectId}/machines/${machineId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${flyApiKey}`,
          },
        },
      );

      return response;
    },
    create: async ({
      projectId,
      versionId,
      config,
    }: {
      projectId: string;
      versionId: string;
      config?: paths["/apps/{app_name}/machines"]["post"]["requestBody"]["content"]["application/json"]["config"];
    }) => {
      try {
        const response = await ofetch<
          paths["/apps/{app_name}/machines"]["post"]["responses"][200]["content"]["application/json"]
        >(`${flyApiHostname}/v1/apps/preview-app-${projectId}/machines`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${flyApiKey}`,
          },
          body: {
            name: `preview-machine-${projectId}-${versionId}`,
            region: "iad",
            config: {
              image: "registry.fly.io/boilerplates:next",
              guest: {
                cpu_kind: "shared",
                cpus: 2,
                memory_mb: 2048,
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
              ...config,
            },
          } satisfies components["schemas"]["CreateMachineRequest"],
          retry: 3,
          retryDelay: 500,
          async onRequestError({ request, options, error }) {
            console.error("[fetch request error]", {
              url: request,
              error: error.message,
              stack: error.stack,
            });
            throw error;
          },
          async onResponseError({ request, options, response }) {
            console.error("[fetch response error]", {
              url: request,
              status: response.status,
              statusText: response.statusText,
            });
            throw new Error(`Failed to create machine: ${response.statusText}`);
          },
        });

        if (!response.id) {
          throw new Error("Failed to create machine");
        }

        await Fly.machine.waitFor({
          projectId,
          machineId: response.id,
          state: "started",
        });

        return response.id;
      } catch (error) {
        console.error("Error creating machine:", {
          error: error instanceof Error ? error.message : String(error),
          projectId,
          versionId,
        });
        throw error;
      }
    },
    update: async ({
      projectId,
      machineId,
      files,
    }: {
      projectId: string;
      machineId: string;
      files?: { guest_path: string; raw_value: string }[];
    }) => {
      try {
        await ofetch(
          `${flyApiHostname}/v1/apps/preview-app-${projectId}/machines/${machineId}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${flyApiKey}`,
            },
            body: {
              config: {
                image: "registry.fly.io/boilerplates:next",
                files,
              },
            } satisfies components["schemas"]["UpdateMachineRequest"],
          },
        );
      } catch (error) {
        console.error("Error updating machine:", {
          error: error instanceof Error ? error.message : String(error),
          projectId,
          machineId,
        });
        throw error;
      }
    },
    destroy: async ({
      projectId,
      machineId,
    }: {
      projectId: string;
      machineId: string;
    }) => {
      try {
        await ofetch(
          `${flyApiHostname}/v1/apps/preview-app-${projectId}/machines/${machineId}?force=true`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${flyApiKey}`,
            },
            retry: 3,
            retryDelay: 500,
            async onRequestError({ request, options, error }) {
              console.error("[fetch request error]", {
                url: request,
                error: error.message,
                stack: error.stack,
              });
              throw error;
            },
            async onResponseError({ request, options, response }) {
              console.error("[fetch response error]", {
                url: request,
                status: response.status,
                statusText: response.statusText,
              });
              throw new Error(
                `Failed to destroy machine: ${response.statusText}`,
              );
            },
          },
        );
      } catch (error) {
        console.error("Error destroying machine:", {
          error: error instanceof Error ? error.message : String(error),
          projectId,
          machineId,
        });
        throw error;
      }
    },
    waitFor: async ({
      projectId,
      machineId,
      state = "started",
    }: {
      projectId: string;
      machineId: string;
      state?: "started" | "stopped" | "suspended" | "destroyed";
    }) => {
      await ofetch(
        `${flyApiHostname}/v1/apps/preview-app-${projectId}/machines/${machineId}/wait?state=${state}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${flyApiKey}`,
          },
          retry: 3,
          retryDelay: 500,
          async onRequestError({ request, options, error }) {
            console.error("[fetch request error]", {
              url: request,
              error: error.message,
              stack: error.stack,
            });
            throw error;
          },
          async onResponseError({ request, options, response }) {
            console.error("[fetch response error]", {
              url: request,
              status: response.status,
              statusText: response.statusText,
            });
            throw new Error(
              `Failed to wait for machine to start: ${response.statusText}`,
            );
          },
        },
      );
    },
    start: async ({
      projectId,
      machineId,
    }: {
      projectId: string;
      machineId: string;
    }) => {
      await ofetch(
        `${flyApiHostname}/v1/apps/preview-app-${projectId}/machines/${machineId}/start`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${flyApiKey}`,
          },
        },
      );
    },
    executeCommand: async ({
      projectId,
      machineId,
      command,
      timeout = 120,
    }: {
      projectId: string;
      machineId: string;
      command: string;
      timeout?: number;
    }) => {
      // Start the machine if it's not already running
      await Fly.machine.start({
        projectId,
        machineId,
      });

      const response = await ofetch<
        paths["/apps/{app_name}/machines/{machine_id}/exec"]["post"]["responses"][200]["content"]["application/json"]
      >(
        `${flyApiHostname}/v1/apps/preview-app-${projectId}/machines/${machineId}/exec`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${flyApiKey}`,
          },
          body: {
            command: ["/bin/sh", "-c", command],
            timeout,
          } satisfies components["schemas"]["MachineExecRequest"],
        },
      );

      return response;
    },
  },
};
