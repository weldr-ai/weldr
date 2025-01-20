import "server-only";

import { ofetch } from "ofetch/node";

const flyApiHostname = process.env.FLY_API_HOSTNAME;
const flyApiKey = process.env.FLY_API_KEY;
const flyOrgSlug = process.env.FLY_ORG_SLUG;

async function createApp({
  appName,
  networkName,
}: {
  appName: string;
  networkName: string;
}) {
  try {
    await ofetch(`${flyApiHostname}/v1/apps`, {
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
  } catch (error) {
    console.error("Error creating app:", {
      error: error instanceof Error ? error.message : String(error),
      appName,
      networkName,
    });
    throw error;
  }
}

async function createMachine({
  projectId,
  versionId,
  files,
  packages,
}: {
  projectId: string;
  versionId: string;
  files: { guest_path: string; raw_value: string }[];
  packages: {
    production: string[];
    development: string[];
  };
}) {
  try {
    const response = await ofetch<{ id: string }>(
      `${flyApiHostname}/v1/apps/preview-app-${projectId}/machines`,
      {
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
              cpus: 1,
              memory_mb: 1024,
            },
            files,
            services: [
              {
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
                protocol: "tcp",
                internal_port: 3000,
              },
            ],
          },
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
          throw new Error(`Failed to create machine: ${response.statusText}`);
        },
      },
    );

    try {
      await waitForMachine(projectId, response.id);
    } catch (error) {
      await destroyMachine(projectId, response.id);
      throw error;
    }

    const installPackagesCommand = [];

    console.log("packages", packages);

    if (packages.production.length > 0 || packages.development.length > 0) {
      installPackagesCommand.push("cd /src");
    }

    if (packages.production.length > 0) {
      installPackagesCommand.push(`bun add ${packages.production.join(" ")}`);
    }

    if (packages.development.length > 0) {
      installPackagesCommand.push(
        `bun add -D ${packages.development.join(" ")}`,
      );
    }

    await executeCommand(projectId, response.id, [
      "sh",
      "-c",
      installPackagesCommand.join(" && "),
    ]);

    return response.id;
  } catch (error) {
    console.error("Error creating machine:", {
      error: error instanceof Error ? error.message : String(error),
      projectId,
      versionId,
    });
    throw error;
  }
}

async function destroyMachine(projectId: string, machineId: string) {
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
          throw new Error(`Failed to destroy machine: ${response.statusText}`);
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
}

async function waitForMachine(projectId: string, machineId: string) {
  const response = await ofetch<{ ok: boolean }>(
    `${flyApiHostname}/v1/apps/preview-app-${projectId}/machines/${machineId}/wait?state=started`,
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

  if (!response.ok) {
    throw new Error("Failed to wait for machine to start");
  }

  return response.ok;
}

export async function executeCommand(
  projectId: string,
  machineId: string,
  command: string[],
) {
  await ofetch(
    `${flyApiHostname}/v1/apps/preview-app-${projectId}/machines/${machineId}/exec`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${flyApiKey}`,
      },
      body: {
        command: command,
        timeout: 60,
      },
    },
  );
}

export const Fly = {
  App: {
    create: createApp,
  },
  Machine: {
    create: createMachine,
    destroy: destroyMachine,
    waitFor: waitForMachine,
    executeCommand: executeCommand,
  },
};
