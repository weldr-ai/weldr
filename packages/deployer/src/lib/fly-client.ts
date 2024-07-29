import axios from "axios";

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

export const createFlyApp = async (workspaceId: string) => {
  console.log(process.env.FLY_API_TOKEN);
  try {
    const response = await axios.post(
      `${process.env.FLY_API_HOSTNAME}/v1/apps`,
      {
        app_name: workspaceId,
        org_slug: process.env.FLY_ORG_SLUG,
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

    return {
      message: "App created successfully",
      data: response.data,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const errorMessage =
        error.response?.data?.error ||
        "An error occurred while creating the app";
      console.error("Error creating app:", errorMessage);
      throw new Error(errorMessage);
    }

    console.error("Error creating app:", error);
    throw new Error(`An error occurred while creating the app: ${error}`);
  }
};

export const createFlyAppWithRetry = async (workspaceId: string) => {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const app = await createFlyApp(workspaceId);
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
};

export const getFlyApp = async (workspaceId: string) => {
  const response = await axios.get<FlyApp>(
    `${process.env.FLY_API_HOSTNAME}/v1/apps/${workspaceId}`,
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
};

export const deleteFlyApp = async (workspaceId: string, force = false) => {
  const response = await axios.delete(
    `${process.env.FLY_API_HOSTNAME}/v1/apps/${workspaceId}?force=${force}`,
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
};
