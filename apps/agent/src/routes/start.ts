import { createRouter } from "@/lib/hono-utils";
import { initVersion } from "@/lib/init-version";
import { mastra } from "@/mastra";
import type { TStreamableValue } from "@/types";
import { createRoute, z } from "@hono/zod-openapi";
import { auth } from "@weldr/auth";
import { and, db, eq, isNotNull } from "@weldr/db";
import { projects, versions } from "@weldr/db/schema";

const route = createRoute({
  method: "post",
  path: "/start",
  summary: "Start the agent",
  description: "Start the agent",
  tags: ["Agent"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            projectId: z.string().openapi({ description: "Project ID" }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Agent started",
    },
    400: {
      description: "Bad request",
    },
    401: {
      description: "Unauthorized",
    },
    404: {
      description: "Not found",
    },
  },
});

const router = createRouter();

router.openapi(route, async (c) => {
  const { projectId } = c.req.valid("json");

  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const project = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, projectId),
      eq(projects.userId, session.user.id),
    ),
  });

  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  let activeVersion = await db.query.versions.findFirst({
    where: and(
      eq(versions.projectId, projectId),
      isNotNull(versions.activatedAt),
    ),
  });

  if (!activeVersion || activeVersion.progress === "succeeded") {
    activeVersion = await initVersion({
      projectId,
      userId: session.user.id,
    });
  }

  const stream = new TransformStream<TStreamableValue>({
    async transform(chunk, controller) {
      controller.enqueue(`${JSON.stringify(chunk)}|CHUNK|`);
    },
  });
  const streamWriter = stream.writable.getWriter();
  const runtimeContext = c.get("runtimeContext");
  runtimeContext.set("streamWriter", streamWriter);
  runtimeContext.set("project", project);
  runtimeContext.set("version", activeVersion);
  runtimeContext.set("user", session.user);

  const run = mastra.getWorkflow("codingWorkflow").createRun();

  await run.start({ runtimeContext });

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "Transfer-Encoding": "chunked",
    },
  });
});

export default router;
