import { ofetch } from "ofetch/node";
import type { components, paths } from "./types";

const flyApiHostname = process.env.FLY_API_HOSTNAME;
const flyApiKey = process.env.FLY_API_KEY;
const flyOrgSlug = process.env.FLY_ORG_SLUG;

type FlyAppType = "production" | "development";

export const flyConfigPresets = {
  development: {
    image: "registry.fly.io/weldr-images:dev-node",
    guest: {
      cpu_kind: "shared",
      cpus: 1,
      memory_mb: 1024,
    },
  } satisfies paths["/apps/{app_name}/machines"]["post"]["requestBody"]["content"]["application/json"]["config"],
  preview: {
    image: "registry.fly.io/weldr-images:preview-runner",
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
};

export const Fly = {
  app: {
    create: async ({
      type,
      projectId,
    }: {
      type: FlyAppType;
      projectId: string;
    }) => {
      try {
        const app = await ofetch<{ id: string }>(`${flyApiHostname}/v1/apps`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${flyApiKey}`,
          },
          body: {
            app_name: `app-${type}-${projectId}`,
            network: `net-${type}-${projectId}`,
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
                appId: `app-${type}-${projectId}`,
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
          projectId,
          type,
        });
        throw error;
      }
    },
    delete: async ({
      type,
      projectId,
    }: {
      type: FlyAppType;
      projectId: string;
    }) => {
      await ofetch(`${flyApiHostname}/v1/apps/app-${type}-${projectId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${flyApiKey}`,
        },
      });
    },
  },
  machine: {
    get: async ({
      type,
      projectId,
      machineId,
    }: {
      type: "production" | "development";
      projectId: string;
      machineId: string;
    }) => {
      const response = await ofetch<components["schemas"]["Machine"]>(
        `${flyApiHostname}/v1/apps/app-${type}-${projectId}/machines/${machineId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${flyApiKey}`,
          },
        },
      );

      return response;
    },
    list: async ({
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
        },
      );

      return response;
    },
    create: async ({
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
                `Failed to create machine: ${response.statusText}`,
              );
            },
          });

          if (!response.id) {
            throw new Error("Failed to create machine");
          }

          await Fly.machine.waitFor({
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
    },
    destroy: async ({
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
        },
      );
    },
    executeCommand: async ({
      type,
      projectId,
      machineId,
      command,
      timeout = 120,
    }: {
      type: FlyAppType;
      projectId: string;
      machineId: string;
      command: string;
      timeout?: number;
    }) => {
      // Start the machine if it's not already running
      await Fly.machine.start({
        type,
        projectId,
        machineId,
      });

      const response = await ofetch<
        paths["/apps/{app_name}/machines/{machine_id}/exec"]["post"]["responses"][200]["content"]["application/json"]
      >(
        `${flyApiHostname}/v1/apps/app-${type}-${projectId}/machines/${machineId}/exec`,
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
    getDevNodeId: async ({
      projectId,
    }: {
      projectId: string;
    }) => {
      const [machine] = await Fly.machine.list({
        type: "development",
        projectId,
      });

      if (!machine || !machine.id) {
        throw new Error("No development machine found");
      }

      if (machine.state !== "started") {
        await Fly.machine.start({
          type: "development",
          projectId,
          machineId: machine.id,
        });
      }

      return machine.id;
    },
    readFile: async ({
      projectId,
      machineId,
      path,
    }: {
      projectId: string;
      machineId: string;
      path: string;
    }): Promise<{ error: string | null; content: string | null }> => {
      const response = await Fly.machine.executeCommand({
        type: "development",
        projectId,
        machineId,
        command: `cat ${path}`,
      });

      if (response.exit_code !== 0 || response.stderr || !response.stdout) {
        return {
          error: `Failed to read file ${path} - ${response.stderr}`,
          content: null,
        };
      }

      return {
        error: null,
        content: response.stdout as string,
      };
    },
    writeFile: async ({
      projectId,
      machineId,
      path,
      content,
    }: {
      projectId: string;
      machineId: string;
      path: string;
      content: string;
    }): Promise<{ error: string | null; success: boolean }> => {
      const response = await Fly.machine.executeCommand({
        type: "development",
        projectId,
        machineId,
        command: `echo "${Buffer.from(content).toString("base64")}" | base64 -d > ${path}`,
      });

      if (response.exit_code !== 0 || response.stderr) {
        return {
          error: `Failed to write file ${path} - ${response.stderr}`,
          success: false,
        };
      }

      return {
        error: null,
        success: true,
      };
    },
    deleteFile: async ({
      projectId,
      machineId,
      path,
    }: {
      projectId: string;
      machineId: string;
      path: string;
    }): Promise<{ error: string | null; success: boolean }> => {
      const response = await Fly.machine.executeCommand({
        type: "development",
        projectId,
        machineId,
        command: `rm ${path}`,
      });

      if (response.exit_code !== 0 || response.stderr) {
        return {
          error: `Failed to delete file ${path} - ${response.stderr}`,
          success: false,
        };
      }

      return {
        error: null,
        success: true,
      };
    },
  },
  secrets: {
    create: async ({
      type,
      projectId,
      key,
      value,
    }: {
      type: FlyAppType;
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
              appId: `app-${type}-${projectId}`,
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
      type,
      projectId,
      secretKeys,
    }: {
      type: FlyAppType;
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
              appId: `app-${type}-${projectId}`,
              keys: secretKeys,
            },
          },
        },
      });
    },
  },
};
