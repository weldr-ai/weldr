import { exec as _exec } from "node:child_process";
import { promisify } from "node:util";
import axios from "axios";

const exec = promisify(_exec);

interface FlyApp {
  id: string;
  name: string;
  status: string;
  organization: {
    name: string;
    slug: string;
  };
}

export async function createFlyApp(appId: string): Promise<FlyApp> {
  const response = await axios.post(
    `${process.env.FLY_API_HOSTNAME}/v1/apps`,
    {
      app_name: appId,
      org_slug: process.env.FLY_ORG_SLUG,
      network: `${appId}-network`,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.FLY_API_KEY}`,
        "Content-Type": "application/json",
      },
    },
  );

  if (response.status !== 201) {
    console.error("Unexpected response from Fly.io:", response.status);
    throw new Error("Error creating app: Unexpected response from Fly.io");
  }

  return response.data;
}

export async function allocateFlyIp(appId: string) {
  await exec(`fly ips allocate-v4 -a ${appId} --yes`);
}

export async function createEnvironmentVariable(
  appId: string,
  key: string,
  value: string,
) {
  await exec(`fly secrets set ${key}=${value} -a ${appId}`);
}

export async function getFlyApp(appId: string) {
  const response = await axios.get<FlyApp>(
    `${process.env.FLY_API_HOSTNAME}/v1/apps/${appId}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.FLY_API_KEY}`,
        "Content-Type": "application/json",
      },
    },
  );

  if (response.status !== 200) {
    throw new Error("Failed to get Fly app");
  }

  return response.data;
}

export async function deleteFlyApp(appId: string, force = false) {
  const response = await axios.delete(
    `${process.env.FLY_API_HOSTNAME}/v1/apps/${appId}?force=${force}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.FLY_API_KEY}`,
        "Content-Type": "application/json",
      },
    },
  );

  if (response.status !== 200) {
    throw new Error("Failed to delete Fly app");
  }

  return response.data;
}

export async function createDockerImage({
  appId,
  dockerImageName,
  outputTag,
}: {
  appId: string;
  dockerImageName: string;
  outputTag: string;
}) {
  try {
    await exec(
      `docker tag ${dockerImageName}:latest registry.fly.io/${appId}:${outputTag}`,
    );
    await exec(`docker push registry.fly.io/${appId}:${outputTag}`);
  } catch (error) {
    throw new Error(`An error occurred while pushing Docker image: ${error}`);
  }
}

export async function createFlyMachine(
  appId: string,
  image: string,
  config?: {
    guest?: {
      cpu_kind?: "shared" | "performance";
      cpus?: number;
      memory_mb?: number;
    };
  },
): Promise<{ id: string } | undefined> {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.FLY_API_KEY}`,
  };

  const data = {
    config: {
      image,
      guest: {
        cpu_kind: config?.guest?.cpu_kind ?? "shared",
        cpus: config?.guest?.cpus ?? 1,
        memory_mb: config?.guest?.memory_mb ?? 256,
      },
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
  };

  const response = await axios.post(
    `${process.env.FLY_API_HOSTNAME}/v1/apps/${appId}/machines`,
    data,
    { headers },
  );

  return {
    id: response.data.id,
  };
}
