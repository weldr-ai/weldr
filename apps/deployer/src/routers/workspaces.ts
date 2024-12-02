import {
  createRouter,
  eventHandler,
  readValidatedBody,
  setResponseStatus,
} from "h3";
import { z } from "zod";
import {
  createDockerImage,
  createFlyApp,
  createFlyMachine,
  deleteFlyApp,
} from "../utils/fly-client";

const router = createRouter();

router.post(
  "/workspaces",
  eventHandler(async (event) => {
    if (event.headers.get("content-type") !== "application/json") {
      setResponseStatus(event, 415);
      return { message: "Content-Type must be application/json" };
    }

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

      await createDockerImage({
        workspaceId,
        dockerImageName: "integramind/engine",
        outputTag: "engine",
      });

      const executorMachine = await createFlyMachine(
        workspaceId,
        `registry.fly.io/${workspaceId}:engine`,
        {
          guest: {
            cpus: 1,
            memory_mb: 1024,
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
  }),
);

router.delete(
  "/workspaces/:workspaceId",
  eventHandler(async (event) => {
    if (event.headers.get("content-type") !== "application/json") {
      setResponseStatus(event, 415);
      return { message: "Content-Type must be application/json" };
    }

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
  }),
);

export default router;
