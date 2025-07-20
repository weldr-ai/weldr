import { ofetch } from "ofetch/node";

import { ofetchConfig } from "../ofetch-config";
import { type FlyAppType, flyApiKey } from "./config";

export const create = async ({
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
    ...ofetchConfig({ tag: `fly:secret:create:${projectId}` }),
  });
};

export const destroy = async ({
  type,
  projectId,
  secretKeys,
}: {
  type: FlyAppType;
  projectId: string;
  secretKeys: string[];
}) => {
  try {
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
      ...ofetchConfig({ tag: `fly:secret:destroy:${projectId}` }),
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
