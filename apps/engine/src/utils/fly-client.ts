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

const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function createFlyApp(workspaceName: string) {
  try {
    const response = await axios.post(
      `${process.env.FLY_API_HOSTNAME}/v1/apps`,
      {
        app_name: workspaceName,
        org_slug: process.env.FLY_ORG_SLUG,
        network: `${workspaceName}-network`,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.FLY_API_TOKEN}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (response.status !== 201) {
      console.error("Unexpected response from Fly.io:", response.status);
      throw new Error("Error creating app: Unexpected response from Fly.io");
    }

    await exec(`fly ips allocate-v4 -a ${workspaceName}`);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const errorMessage =
        error.response?.data?.error ||
        "An error occurred while creating the app";
      console.error("Error creating app:", errorMessage);
      throw new Error(errorMessage);
    }
    console.error("Error creating app:", error);
  }
}

export async function createFlyAppWithRetry(workspaceName: string) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const app = await createFlyApp(workspaceName);
      console.log(`Fly app created successfully on attempt ${attempt}:`, app);
      return;
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error);
      if (attempt === MAX_RETRIES) {
        throw error;
      }
      await sleep(RETRY_DELAY);
    }
  }
}

export async function getFlyApp(workspaceName: string) {
  const response = await axios.get<FlyApp>(
    `${process.env.FLY_API_HOSTNAME}/v1/apps/${workspaceName}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.FLY_API_TOKEN}`,
        "Content-Type": "application/json",
      },
    },
  );

  if (response.status !== 200) {
    throw new Error("Failed to get Fly app");
  }

  return response.data;
}

export async function deleteFlyApp(workspaceName: string, force = false) {
  const response = await axios.delete(
    `${process.env.FLY_API_HOSTNAME}/v1/apps/${workspaceName}?force=${force}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.FLY_API_TOKEN}`,
        "Content-Type": "application/json",
      },
    },
  );

  if (response.status !== 200) {
    throw new Error("Failed to delete Fly app");
  }

  return response.data;
}

export async function createDockerImage(
  workspaceName: string,
  imageName: string,
) {
  try {
    await exec(
      `docker tag integramind/${imageName}:latest registry.fly.io/${workspaceName}:${imageName}`,
    );
    await exec(`docker push registry.fly.io/${workspaceName}:${imageName}`);
  } catch (error) {
    throw new Error(`An error occurred while pushing Docker image: ${error}`);
  }
}

export async function createFlyMachine(
  workspaceName: string,
  imageName: string,
): Promise<{ id: string } | undefined> {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.FLY_API_TOKEN}`,
  };

  const data = {
    config: {
      image: `registry.fly.io/${workspaceName}:${imageName}`,
      guest: {
        cpu_kind: "shared",
        cpus: 1,
        memory_mb: 256,
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

  try {
    const response = await axios.post(
      `${process.env.FLY_API_HOSTNAME}/v1/apps/${workspaceName}/machines`,
      data,
      { headers },
    );
    return {
      id: response.data.id,
    };
  } catch (error) {
    console.error(error);
  }
}
