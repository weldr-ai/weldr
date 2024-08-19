import { z } from "zod";

export default eventHandler(async (event) => {
  const validationSchema = z.object({
    workspaceName: z.string(),
  });

  const body = await readValidatedBody(event, validationSchema.safeParse);

  if (body.error) {
    setResponseStatus(event, 400);
    return { message: "Invalid request body" };
  }

  const { workspaceName } = body.data;

  await createFlyApp(workspaceName);

  await createDockerImage(workspaceName, "executor");

  const flyMachine = await createFlyMachine(workspaceName, "executor");

  if (!flyMachine) {
    setResponseStatus(event, 500);
    await deleteFlyApp(workspaceName);
    return { message: "Failed to create new App" };
  }

  return {
    message: "App created successfully",
    executorMachineId: flyMachine.id,
  };
});
