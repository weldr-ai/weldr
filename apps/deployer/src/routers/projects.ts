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
  "/projects",
  eventHandler(async (event) => {
    if (event.headers.get("content-type") !== "application/json") {
      setResponseStatus(event, 415);
      return { message: "Content-Type must be application/json" };
    }

    const validationSchema = z.object({
      projectId: z.string(),
    });

    const body = await readValidatedBody(event, validationSchema.safeParse);

    if (body.error) {
      setResponseStatus(event, 400);
      return { message: "Invalid request body" };
    }

    const { projectId } = body.data;

    try {
      const flyApp = await createFlyApp(projectId);

      if (!flyApp) {
        setResponseStatus(event, 500);
        return { message: "Failed to create Fly app" };
      }

      await createDockerImage({
        projectId,
        dockerImageName: "integramind/engine",
        outputTag: "engine",
      });

      const engineMachine = await createFlyMachine(
        projectId,
        `registry.fly.io/${projectId}:engine`,
        {
          guest: {
            cpus: 1,
            memory_mb: 1024,
          },
        },
      );

      if (!engineMachine) {
        setResponseStatus(event, 500);
        await deleteFlyApp(projectId);
        return { message: "Failed to create new App" };
      }

      setResponseStatus(event, 201);
      return {
        engineMachineId: engineMachine.id,
      };
    } catch (error) {
      console.error(error);
      setResponseStatus(event, 500);
      await deleteFlyApp(projectId);
      return { message: "Failed to create Fly app" };
    }
  }),
);

router.delete(
  "/projects/:projectId",
  eventHandler(async (event) => {
    if (event.headers.get("content-type") !== "application/json") {
      setResponseStatus(event, 415);
      return { message: "Content-Type must be application/json" };
    }

    const validationSchema = z.object({
      projectId: z.string(),
    });

    const body = await readValidatedBody(event, validationSchema.safeParse);

    if (body.error) {
      setResponseStatus(event, 400);
      return { message: "Invalid request body" };
    }

    const { projectId } = body.data;

    try {
      await deleteFlyApp(projectId);

      setResponseStatus(event, 200);
      return { message: "App deleted" };
    } catch (error) {
      console.error(error);
      setResponseStatus(event, 500);
      return { message: "Failed to delete app" };
    }
  }),
);

export default router;
