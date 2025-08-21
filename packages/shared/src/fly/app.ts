import { ofetch } from "ofetch/node";

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

      await allocateIpAddress({
        type,
        projectId,
      });

      if (type === "development") {
        // Create Tigris bucket
        const bucketCredentials = await Tigris.bucket.create(
          `app-${projectId}`,
        );

        const previewDeployToken = await deployToken({
          type,
          projectId,
        });

        const productionDeployToken = await deployToken({
          type: "production",
          projectId,
        });

        await Promise.all([
          // Create secrets
          Secret.create({
            type: "development",
            projectId,
            secrets: [
              {
                key: "S3_ACCESS_KEY_ID",
                value: bucketCredentials.accessKeyId,
              },
              {
                key: "S3_SECRET_ACCESS_KEY",
                value: bucketCredentials.secretAccessKey,
              },
              {
                key: "S3_BUCKET_NAME",
                value: `app-${projectId}`,
              },
              {
                key: "FLY_PREVIEW_DEPLOY_TOKEN",
                value: previewDeployToken,
              },
              {
                key: "FLY_PRODUCTION_DEPLOY_TOKEN",
                value: productionDeployToken,
              },
            ],
          }),
          // Create development node
          Machine.create({
            type: "development",
            projectId,
            config: Machine.presets.development(projectId),
          }),
          // Create standby node
          Machine.create({
            type: "development",
            projectId,
            config: Machine.presets.development(projectId),
          }),
        ]);
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
        ...(type === "development"
          ? [Tigris.bucket.delete(`app-${projectId}`)]
          : []),
      ]);
      throw error;
    }
  };

  export const deployToken = async ({
    type,
    projectId,
  }: {
    type: FlyAppType;
    projectId: string;
  }) => {
    const deployToken = await ofetch<{
      token: string;
    }>(`${flyApiHostname}/v1/apps/app-${type}-${projectId}/deploy_token`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${flyApiKey}`,
      },
      ...ofetchConfig({ tag: `fly:app:create-deploy-token:${projectId}` }),
    });

    return deployToken.token;
  };

  export const allocateIpAddress = async ({
    type,
    projectId,
  }: {
    type: FlyAppType;
    projectId: string;
  }) => {
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
