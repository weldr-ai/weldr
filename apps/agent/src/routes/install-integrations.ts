import { createRoute, z } from "@hono/zod-openapi";
import { installQueuedIntegrations } from "@/integrations/utils/queue-installer";
import { processIntegrationQueue } from "@/integrations/utils/queue-manager";
import { createRouter } from "@/lib/utils";
import { workflow } from "@/workflow";

import { auth } from "@weldr/auth";
import { and, db, desc, eq, isNotNull } from "@weldr/db";
import { projects, versions } from "@weldr/db/schema";
import { Logger } from "@weldr/shared/logger";

const route = createRoute({
  method: "post",
  path: "/integrations/install",
  summary: "Install queued integrations",
  description: "Process and install all queued integrations for a project",
  tags: ["Integrations"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            projectId: z.string().openapi({ description: "Project ID" }),
            triggerWorkflow: z.boolean().optional().default(false),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Integrations installed successfully",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            installedIntegrations: z.array(
              z.object({
                id: z.string(),
                key: z.string(),
                status: z.string(),
              }),
            ),
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
      description: "Project not found",
    },
    500: {
      description: "Installation failed",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            error: z.string(),
          }),
        },
      },
    },
  },
});

const router = createRouter();

router.openapi(route, async (c) => {
  const { projectId, triggerWorkflow } = c.req.valid("json");
  const logger = Logger.get({ projectId });

  try {
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
            integrationTemplate: true,
          },
        },
      },
    });

    if (!project) {
      return c.json({ error: "Project not found" }, 404);
    }

    const integrations = project.integrations.reduce((acc, integration) => {
      if (integration.integrationTemplate.category === "backend") {
        acc.add("backend");
      }
      if (integration.integrationTemplate.category === "frontend") {
        acc.add("frontend");
      }
      if (integration.integrationTemplate.category === "authentication") {
        acc.add("authentication");
      }
      if (integration.integrationTemplate.category === "database") {
        acc.add("database");
      }
      return acc;
    }, new Set<"backend" | "frontend" | "authentication" | "database">());

    const activeVersion = await db.query.versions.findFirst({
      where: and(
        eq(versions.projectId, projectId),
        isNotNull(versions.activatedAt),
      ),
      orderBy: desc(versions.createdAt),
    });

    if (!activeVersion) {
      logger.error("No active version found", {
        extra: { projectId },
      });
      return c.json({ success: false }, 500);
    }

    const workflowContext = c.get("workflowContext");
    workflowContext.set("project", { ...project, config: integrations });
    workflowContext.set("version", activeVersion);
    workflowContext.set("user", session.user);
    workflowContext.set("isXML", true);

    await processIntegrationQueue(workflowContext);

    const result = await installQueuedIntegrations(workflowContext);

    if (result.status === "error") {
      logger.error("Integration installation failed", {
        extra: { error: result.error },
      });
      return c.json(
        {
          success: false,
          error: result.error,
        },
        500,
      );
    }

    if (triggerWorkflow) {
      await workflow.execute({
        context: workflowContext,
      });
    }

    logger.info("Integration installation completed successfully", {
      extra: { installedCount: result.installedIntegrations.length },
    });

    return c.json({ success: true });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    logger.error("Integration installation process failed", {
      extra: { error: errorMessage },
    });

    return c.json({ success: false }, 500);
  }
});

export default router;
