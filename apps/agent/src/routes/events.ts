import { createRouter } from "@/lib/hono-utils";
import { initVersion } from "@/lib/init-version";
import type { TStreamableValue } from "@/types";
import { createRoute, z } from "@hono/zod-openapi";
import { auth } from "@weldr/auth";
import { and, db, eq, isNotNull } from "@weldr/db";
import { projects, versions } from "@weldr/db/schema";

const route = createRoute({
  method: "get",
  path: "/events/:projectId",
  summary: "Subscribe to workflow events",
  description: "Subscribe to workflow events via SSE",
  tags: ["Agent"],
  request: {
    params: z.object({
      projectId: z.string().openapi({ description: "Project ID" }),
    }),
  },
  responses: {
    200: {
      description: "SSE stream started",
      headers: {
        "Content-Type": {
          description: "text/event-stream",
        },
        "Cache-Control": {
          description: "no-cache",
        },
        Connection: {
          description: "keep-alive",
        },
      },
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
  const { projectId } = c.req.valid("param");

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

  const streamId = activeVersion.chatId;
  const clientId = `client:${Date.now()}:${Math.random().toString(36)}`;

  // Setup SSE stream
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      // Send connection established event
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({
            type: "connected",
            clientId,
            streamId,
          })}\n\n`,
        ),
      );

      // Create a stream writer for this SSE connection
      const sseStreamWriter = {
        write: async (chunk: TStreamableValue) => {
          const message = JSON.stringify(chunk);
          // Send to current client
          try {
            controller.enqueue(encoder.encode(`data: ${message}\n\n`));
          } catch (error) {
            console.log(`Client ${clientId} disconnected`);
          }
        },
        close: async () => {
          try {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "workflow_complete" })}\n\n`,
              ),
            );
            controller.close();
          } catch (error) {
            console.log(`Client ${clientId} already disconnected`);
          }
        },
      };

      // Store this connection's stream writer globally so workflows can write to it
      // We'll use a simple in-memory map keyed by streamId
      if (!global.sseConnections) {
        global.sseConnections = new Map();
      }
      global.sseConnections.set(streamId, sseStreamWriter);

      // Note: Cleanup happens in cancel() method below
    },

    cancel() {
      console.log(
        `Client ${clientId} cancelled connection for stream ${streamId}`,
      );
      if (global.sseConnections) {
        global.sseConnections.delete(streamId);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Cache-Control",
    },
  });
});

export default router;
