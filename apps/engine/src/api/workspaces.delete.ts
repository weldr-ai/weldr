import { z } from "zod";
import { deleteFlyApp } from "~/utils/fly-client";

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
    await deleteFlyApp(workspaceId);

    setResponseStatus(event, 200);
    return { message: "Workspace deleted" };
  } catch (error) {
    console.error(error);
    setResponseStatus(event, 500);
    return { message: "Failed to delete workspace" };
  }
});
