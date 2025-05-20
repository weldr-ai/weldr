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
    delete: async ({
      appName,
    }: {
      appName: string;
    }) => {
      await ofetch(`${flyApiHostname}/v1/apps/${appName}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${flyApiKey}`,
        },
      });
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
      region = "us",
    }: {
      projectId: string;
      versionId: string;
      config?: paths["/apps/{app_name}/machines"]["post"]["requestBody"]["content"]["application/json"]["config"];
      region?: "eu" | "us";
    }) => {
      // const euRegions = ["ams", "arn", "mad", "lhr", "cdg", "fra"];
      // const usRegions = ["iad", "ewr", "yul", "yyz", "sjc", "lax"];
      // const allRegions = [
      //   "iad",
      //   "ewr",
      //   "ams",
      //   "arn",
      //   "mad",
      //   "yul",
      //   "yyz",
      //   "lhr",
      //   "cdg",
      //   "fra",
      //   "sjc",
      //   "lax",
      // ];

      // const availableRegions =
      //   region === "eu" ? euRegions : region === "us" ? usRegions : allRegions;

      let lastError: Error | null = null;

      // for (const region of availableRegions) {
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
              image: "registry.fly.io/weldr-runtime:base",
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
        lastError = error instanceof Error ? error : new Error(String(error));
      }
      // }

      throw (
        lastError || new Error("Failed to create machine: All regions failed")
      );
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
  secrets: {
    create: async ({
      projectId,
      key,
      value,
    }: {
      projectId: string;
      key: string;
      value: string;
    }) => {
      await ofetch<{
        data: {
          setSecrets: {
            app: {
              id: string;
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
            mutation($input: SetSecretsInput!) {
              setSecrets(input: $input) {
                app {
                  id
                }
              }
            }
          `,
          variables: {
            input: {
              appId: `preview-app-${projectId}`,
              secrets: [
                {
                  key,
                  value,
                },
              ],
              replaceAll: false,
            },
          },
        },
      });
    },
    destroy: async ({
      projectId,
      secretKeys,
    }: {
      projectId: string;
      secretKeys: string[];
    }) => {
      await ofetch<{
        data: {
          unsetSecrets: {
            app: {
              id: string;
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
            mutation($input: UnsetSecretsInput!) {
              unsetSecrets(input: $input) {
                app {
                  id
                }
              }
            }
          `,
          variables: {
            input: {
              appId: `preview-app-${projectId}`,
              keys: secretKeys,
            },
          },
        },
      });
    },
  },
};
