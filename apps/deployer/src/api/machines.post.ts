import { z } from "zod";
import {
  createDockerImage,
  createFlyMachine,
  deleteFlyApp,
} from "~/utils/fly-client";

export default eventHandler(async (event) => {
  const validationSchema = z.object({
    workspaceId: z.string(),
  });

  const body = await readValidatedBody(event, validationSchema.safeParse);

  if (body.error) {
    setResponseStatus(event, 400);
    return { message: "Invalid request body" };
  }

  const { workspaceId } = body.data;

  try {
    await createDockerImage(workspaceId, "integramind/backend", "latest");

    const machine = await createFlyMachine(
      workspaceId,
      `registry.fly.io/${workspaceId}:latest`,
      {
        guest: {
          cpus: 1,
          memory_mb: 512,
        },
      },
    );

    if (!machine) {
      setResponseStatus(event, 500);
      await deleteFlyApp(workspaceId);
      return { message: "Failed to create new App" };
    }

    setResponseStatus(event, 201);
    return {
      machineId: machine.id,
    };
  } catch (error) {
    console.error(error);
    setResponseStatus(event, 500);
    await deleteFlyApp(workspaceId);
    return { message: "Failed to create Fly app" };
  }
});
