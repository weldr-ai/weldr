import { z } from "zod";
import {
  allocateFlyIp,
  createExecutorDockerImage,
  createFlyApp,
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
    const flyApp = await createFlyApp(workspaceId);

    if (!flyApp) {
      setResponseStatus(event, 500);
      return { message: "Failed to create Fly app" };
    }

    await allocateFlyIp(workspaceId);

    await createExecutorDockerImage(workspaceId);

    const executorMachine = await createFlyMachine(
      workspaceId,
      `registry.fly.io/${workspaceId}:executor`,
      {
        guest: {
          cpus: 1,
          memory_mb: 512,
        },
      },
    );

    if (!executorMachine) {
      setResponseStatus(event, 500);
      await deleteFlyApp(workspaceId);
      return { message: "Failed to create new App" };
    }

    setResponseStatus(event, 201);
    return {
      executorMachineId: executorMachine.id,
    };
  } catch (error) {
    console.error(error);
    setResponseStatus(event, 500);
    await deleteFlyApp(workspaceId);
    return { message: "Failed to create Fly app" };
  }
});
