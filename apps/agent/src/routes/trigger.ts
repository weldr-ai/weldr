import { initVersion } from "@/ai/utils/init-version";
import { insertMessages } from "@/ai/utils/insert-messages";
import { createRouter } from "@/lib/hono-utils";
import { workflow } from "@/workflow";
import { createRoute, z } from "@hono/zod-openapi";
import { auth } from "@weldr/auth";
import { and, db, eq, isNotNull } from "@weldr/db";
import { projects, versions } from "@weldr/db/schema";
import {
  attachmentSchema,
  userMessageContentSchema,
} from "@weldr/shared/validators/chats";

const route = createRoute({
  method: "post",
  path: "/trigger",
  summary: "Trigger workflow with user message",
  description: "Trigger workflow with user message",
  tags: ["Agent"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            projectId: z
              .string()
              .openapi({ description: "Project ID", example: "123abc" }),
            message: z.object({
              content: userMessageContentSchema.array().openapi({
                description: "Message content",
                example: [
                  {
                    type: "text",
                    text: "Hello, Weldr!",
                  },
                ],
              }),
              attachments: attachmentSchema
                .array()
                .optional()
                .openapi({ description: "Message attachments", example: [] }),
            }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Workflow triggered successfully",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            streamId: z.string(),
            runId: z.string(),
          }),
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
  console.log("[trigger] Route handler started");
  const { projectId, message } = c.req.valid("json");

  console.log("[trigger] projectId", projectId);
  console.log("[trigger] message", message);

  console.log("[trigger] Getting session...");
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });
  console.log("[trigger] Session obtained:", !!session);

  if (!session) {
    console.log("[trigger] No session, returning 401");
    return c.json({ error: "Unauthorized" }, 401);
  }

  console.log("[trigger] Finding project...");
  const project = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, projectId),
      eq(projects.userId, session.user.id),
    ),
  });
  console.log("[trigger] Project found:", !!project);

  if (!project) {
    console.log("[trigger] Project not found, returning 404");
    return c.json({ error: "Project not found" }, 404);
  }

  console.log("[trigger] Finding active version...");
  let activeVersion = await db.query.versions.findFirst({
    where: and(
      eq(versions.projectId, projectId),
      isNotNull(versions.activatedAt),
    ),
  });
  console.log("[trigger] Active version found:", !!activeVersion);

  if (!activeVersion || activeVersion.progress === "succeeded") {
    activeVersion = await initVersion({
      projectId,
      userId: session.user.id,
    });
  }

  const streamId = activeVersion.chatId;

  console.log("[trigger] activeVersion", activeVersion);

  const run = await workflow.getRun({ runId: streamId });

  console.log("[trigger] run", run);

  // Check if there's already a running workflow for this stream
  if (run?.status === "running") {
    console.log("[trigger] Workflow already running, returning 200");
    return c.json({
      success: true,
      streamId,
      runId: streamId,
      message: "Workflow already running",
    });
  }

  // Save the user message to database first
  const newMessage = {
    type: "public" as const,
    role: "user" as const,
    content: message.content,
    attachments: message.attachments,
  };

  await insertMessages({
    input: {
      chatId: activeVersion.chatId,
      userId: session.user.id,
      messages: [newMessage],
    },
  });

  console.log("[trigger] newMessage", newMessage);

  // Store the context we need for the workflow
  const workflowContext = c.get("workflowContext");
  workflowContext.set("project", project);
  workflowContext.set("version", activeVersion);
  workflowContext.set("user", session.user);

  await workflow.execute({ runId: streamId, context: workflowContext });

  return c.json({ success: true });
});

export default router;
