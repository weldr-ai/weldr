import { createRoute, z } from "@hono/zod-openapi";
import { initVersion } from "@/ai/utils/init-version";
import { getInstalledCategories } from "@/integrations/utils/get-installed-categories";
import { createRouter } from "@/lib/utils";
import { workflow } from "@/workflow";

import { auth } from "@weldr/auth";
import { and, db, eq, isNotNull } from "@weldr/db";
import { projects, versions } from "@weldr/db/schema";

const route = createRoute({
  method: "post",
  path: "/trigger/{projectId}",
  summary: "Trigger workflow with user message",
  description: "Trigger workflow with user message",
  tags: ["Agent"],
  request: {
    params: z.object({
      projectId: z.string().openapi({ description: "Project ID" }),
    }),
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
    ),
  });

  if (!activeVersion) {
    activeVersion = await initVersion({
      projectId,
      userId: session.user.id,
    });
  }

  // Store the context we need for the workflow
  const workflowContext = c.get("workflowContext");
  workflowContext.set("project", {
    ...project,
    integrationCategories: new Set(installedCategories),
  });
  workflowContext.set("version", activeVersion);
  workflowContext.set("isXML", true);
  workflowContext.set("user", session.user);

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
