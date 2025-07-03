import { initVersion } from "@/ai/utils/init-version";
import { insertMessages } from "@/ai/utils/insert-messages";
import { createRouter } from "@/lib/utils";
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
  const { projectId, message } = c.req.valid("json");

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

  if (!activeVersion) {
    activeVersion = await initVersion({
      projectId,
      userId: session.user.id,
    });
  }

  // Save the user message to database first
  const newMessage = {
    visibility: "public" as const,
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

  // Store the context we need for the workflow
  const workflowContext = c.get("workflowContext");
  workflowContext.set("project", project);
  workflowContext.set("version", activeVersion);
  workflowContext.set("user", session.user);
  workflowContext.set("isXML", true);

  if (
    activeVersion.status !== "completed" &&
    activeVersion.status !== "failed"
  ) {
    await workflow.execute({
      context: workflowContext,
    });
  }

  return c.json({
    success: true,
    runId: activeVersion.chatId,
    streamId: activeVersion.chatId,
  });
});

export default router;
