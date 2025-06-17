import { createRouter } from "@/lib/hono-utils";
import { initVersion } from "@/lib/init-version";
import { insertMessages } from "@/lib/insert-messages";
import { mastra } from "@/mastra";
import { createRoute, z } from "@hono/zod-openapi";
import { auth } from "@weldr/auth";
import { and, db, eq, isNotNull } from "@weldr/db";
import { projects, versions } from "@weldr/db/schema";
import {
  attachmentSchema,
  userMessageRawContentSchema,
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
              content: userMessageRawContentSchema.openapi({
                description: "Message content",
                example: [
                  {
                    type: "paragraph",
                    value: "Hello, Weldr!",
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

  // Save the user message to database first
  const newMessage = {
    role: "user" as const,
    rawContent: message.content,
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

  const storage = mastra.getStorage();

  if (!storage) {
    return c.json({ error: "Storage not found" }, 500);
  }

  // Check for existing workflow run
  const workflowSnapshot = await storage.loadWorkflowSnapshot({
    workflowName: "codingWorkflow",
    runId: streamId,
  });

  console.log("workflowSnapshot", workflowSnapshot);

  // Check if there's already a running workflow for this stream
  if (workflowSnapshot && workflowSnapshot.activePaths.length > 0) {
    return c.json({
      success: true,
      streamId,
      runId: streamId,
      message: "Workflow already running",
    });
  }

  console.log("[trigger] workflowSnapshot", workflowSnapshot);

  // Start new workflow
  const run = mastra
    .getWorkflow("codingWorkflow")
    .createRun({ runId: streamId });

  console.log("[trigger] run", run);

  // Store the context we need for the workflow
  const runtimeContext = c.get("runtimeContext");
  runtimeContext.set("project", project);
  runtimeContext.set("version", activeVersion);
  runtimeContext.set("user", session.user);

  // Start workflow in background
  run.start({ runtimeContext }).catch(async (error) => {
    console.error(`Workflow error for ${streamId}:`, error);

    // Close stream on error
    const streamWriter = global.sseConnections?.get(streamId);
    if (streamWriter) {
      streamWriter.close().catch(console.error);
    }
  });

  // Watch workflow for completion and cleanup
  // run.watch((event) => {
  //   console.log(
  //     `[workflow-watch:${streamId}] Step:`,
  //     event.payload?.currentStep?.id,
  //     "Status:",
  //     event.payload?.currentStep?.status,
  //   );
  //   console.log(
  //     `[workflow-watch:${streamId}] Workflow status:`,
  //     event.payload?.workflowState?.status,
  //   );

  //   // Check if workflow is complete
  //   const workflowStatus = event.payload?.workflowState?.status;
  //   if (workflowStatus === "success" || workflowStatus === "failed") {
  //     console.log(`[workflow-watch:${streamId}] Workflow ${workflowStatus}`);

  //     // Close SSE stream
  //     const streamWriter = global.sseConnections?.get(streamId);
  //     if (streamWriter) {
  //       streamWriter.close().catch((error) => {
  //         console.error(
  //           `[workflow-watch:${streamId}] Failed to close stream:`,
  //           error,
  //         );
  //       });
  //     }
  //   }
  // });

  return c.json({ success: true });
});

export default router;
