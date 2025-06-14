import { ofetch } from "ofetch/node";
import { ofetchConfig } from "../ofetch-config";
import {
  type FlyAppType,
  flyApiHostname,
  flyApiKey,
  flyOrgSlug,
} from "./config";

export const get = async ({
  type,
  projectId,
}: {
  type: FlyAppType;
  projectId: string;
}) => {
  try {
    const app = await ofetch<{ id: string }>(
      `${flyApiHostname}/v1/apps/app-${type}-${projectId}`,
      {
        headers: {
          Authorization: `Bearer ${flyApiKey}`,
        },
        ...ofetchConfig({ tag: `fly:app:get:${projectId}` }),
      },
    );
    return app;
  } catch (error) {
    if (
      (error as { response?: { status?: number } })?.response?.status === 404
    ) {
      return null;
    }
    throw error;
  }
};

export const create = async ({
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
      ...ofetchConfig({ tag: `fly:app:create:${projectId}` }),
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
      ...ofetchConfig({ tag: `fly:app:allocate-ip-address:${projectId}` }),
    });

    if (!ipAddress?.data?.allocateIpAddress?.ipAddress?.address) {
      throw new Error("Failed to allocate IP address");
    }

    return app.id;
  } catch (error) {
    console.error("Error creating app:", {
      error: error instanceof Error ? error.message : String(error),
      projectId,
      type,
    });
    destroy({
      type,
      projectId,
    });
    throw error;
  }
};

export const destroy = async ({
  type,
  projectId,
}: {
  type: FlyAppType;
  projectId: string;
}) => {
  try {
    await ofetch(`${flyApiHostname}/v1/apps/app-${type}-${projectId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${flyApiKey}`,
      },
      ...ofetchConfig({ tag: `fly:app:destroy:${projectId}` }),
    });
  } catch (error) {
    if (
      (error as { response?: { status?: number } })?.response?.status === 404
    ) {
      return;
    }
    throw error;
  }
};
