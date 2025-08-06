import { ofetch } from "ofetch/node";

import { machineLookupStore } from "../machine-lookup-store";
import { ofetchConfig } from "../ofetch-config";
import { Tigris } from "../tigris";
import {
  type FlyAppType,
  flyApiHostname,
  flyApiKey,
  flyOrgSlug,
} from "./config";
import { Machine } from "./machine";
import { Secret } from "./secret";

export namespace App {
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

      if (type === "development") {
        // Create Tigris bucket
        const bucketCredentials = await Tigris.bucket.create(projectId);

        // Create secrets
        await Promise.all([
          Secret.create({
            type: "development",
            projectId,
            key: "AWS_ACCESS_KEY_ID",
            value: bucketCredentials.accessKeyId,
          }),
          Secret.create({
            type: "development",
            projectId,
            key: "AWS_SECRET_ACCESS_KEY",
            value: bucketCredentials.secretAccessKey,
          }),
          Secret.create({
            type: "development",
            projectId,
            key: "FLY_API_TOKEN",
            // biome-ignore lint/style/noNonNullAssertion: reason
            value: process.env.FLY_API_TOKEN!,
          }),
        ]);

        // Create development node
        const devMachineId = await Machine.create({
          type: "development",
          projectId,
          config: Machine.presets.development,
        });

        // Store the machine ID in the lookup store
        await machineLookupStore.set(`dev-machine:${projectId}`, devMachineId);
      }

      return app.id;
    } catch (error) {
      console.error("Error creating app:", {
        error: error instanceof Error ? error.message : String(error),
        projectId,
        type,
      });
      await Promise.all([
        destroy({
          type,
          projectId,
        }),
        Tigris.bucket.delete(projectId),
      ]);
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
}
