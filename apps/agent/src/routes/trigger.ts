import { createRoute, z } from "@hono/zod-openapi";

import { auth } from "@weldr/auth";
import { and, db, eq, isNotNull, not } from "@weldr/db";
import { projects, versions } from "@weldr/db/schema";
import type { UserMessageContent } from "@weldr/shared/types";

import { initVersion } from "@/ai/utils/init-version";
import { insertMessages } from "@/ai/utils/insert-messages";
import { getInstalledCategories } from "@/integrations/utils/get-installed-categories";
import { createRouter } from "@/lib/utils";
import { workflow } from "@/workflow";

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
            message: z
              .object({
                content: z.custom<UserMessageContent>().openapi({
                  description: "Message content",
                  example: [
                    {
                      type: "text",
                      text: "Hello, Weldr!",
                    },
                  ],
                }),
                attachmentIds: z.string().array().optional().openapi({
                  description: "Message attachments",
                  example: [],
                }),
              })
              .optional(),
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
    with: {
      integrations: {
        with: {
          integrationTemplate: {
            with: {
              category: true,
            },
          },
        },
      },
    },
  });

  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  const installedCategories = await getInstalledCategories(projectId);

  let activeVersion = await db.query.versions.findFirst({
    where: and(
      eq(versions.projectId, projectId),
      isNotNull(versions.activatedAt),
      not(eq(versions.status, "completed")),
    ),
  });

  if (!activeVersion) {
    activeVersion = await initVersion({
      projectId,
      userId: session.user.id,
    });
  }

  if (message) {
    await insertMessages({
      input: {
        chatId: activeVersion.chatId,
        userId: session.user.id,
        messages: [
          {
            role: "user" as const,
            content: message.content,
            attachmentIds: message.attachmentIds,
          },
        ],
      },
    });
  }

  // Store the context we need for the workflow
  const workflowContext = c.get("workflowContext");
  workflowContext.set("project", {
    ...project,
    integrationCategories: new Set(installedCategories),
  });
  workflowContext.set("version", activeVersion);
  workflowContext.set("user", session.user);

  if (
    activeVersion.status !== "completed" &&
    activeVersion.status !== "failed"
  ) {
    await workflow.execute({
      context: workflowContext,
    });
  }

  return c.json({ success: true });
});

export default router;
